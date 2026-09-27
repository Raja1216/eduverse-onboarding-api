import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hash } from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  courseIdsForClass,
  normalizeClassGrade,
} from "../config/class-course-map";
import { EnrollmentSource, UserType } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { SendOtpDto } from "./dto/send-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { Msg91Service } from "./msg91.service";

type RegistrationTokenPayload = {
  type: "registration";
  mobilePrefix: string;
  mobile: string;
  iat: number;
  exp: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly msg91: Msg91Service,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    return this.issueOtp(dto, false);
  }

  async resendOtp(dto: SendOtpDto) {
    return this.issueOtp(dto, true);
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const mobile = this.cleanMobile(dto.mobile);
    const mobilePrefix = this.cleanPrefix(dto.mobilePrefix || "+91");
    const maxAttempts = Number(
      this.config.get<string>("OTP_MAX_ATTEMPTS") || 5,
    );

    const otpRecord = await this.prisma.userOtp.findUnique({
      where: { mobile },
    });

    if (!otpRecord) {
      throw new NotFoundException({
        status: false,
        message: "No OTP request found for this mobile number",
      });
    }

    if (otpRecord.mobilePrefix && otpRecord.mobilePrefix !== mobilePrefix) {
      throw new UnauthorizedException({
        status: false,
        message: "Mobile number does not match the OTP request",
      });
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      await this.prisma.userOtp
        .delete({ where: { mobile } })
        .catch(() => undefined);
      throw new UnauthorizedException({
        status: false,
        message: "OTP has expired. Please request a new OTP",
      });
    }

    if (otpRecord.failedAttempts >= maxAttempts) {
      throw new HttpException(
        {
          status: false,
          message: "Too many invalid OTP attempts. Please request a new OTP",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const internationalMobile = this.msg91Mobile(mobilePrefix, mobile);
    console.log("OTP DEBUG:", {
      mobilePrefix,
      mobile,
      internationalMobile,
    });

    try {
      await this.msg91.verifyOtp(internationalMobile, dto.otp);
    } catch (error) {
      await this.prisma.userOtp.update({
        where: { mobile },

        data: {
          failedAttempts: {
            increment: 1,
          },
        },
      });

      throw new UnauthorizedException({
        status: false,
        message: error instanceof Error ? error.message : "Invalid OTP",
      });
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { mobile },
      select: { id: true },
    });

    // OTP is one-time use
    await this.prisma.userOtp.delete({
      where: { mobile },
    });

    if (existingUser) {
      return {
        status: true,
        message: "OTP verified successfully",
        data: {
          verified: true,
          userExists: true,
          registrationToken: null,
        },
      };
    }

    const registrationToken = this.createRegistrationToken(
      mobilePrefix,
      mobile,
    );

    return {
      status: true,
      message: "OTP verified successfully",
      data: {
        verified: true,
        userExists: false,
        registrationToken,
      },
    };
  }

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new UnprocessableEntityException({
        status: false,
        message: "Validation failed",
        errors: {
          confirmPassword: ["Password confirmation does not match"],
        },
      });
    }

    const token = this.verifyRegistrationToken(dto.registrationToken);

    const existingUser = await this.prisma.user.findUnique({
      where: { mobile: token.mobile },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException({
        status: false,
        message: "User is already registered",
        errors: {
          userExists: ["A user is already registered with this mobile number"],
        },
      });
    }

    const school = await this.prisma.institution.findFirst({
      where: {
        id: dto.schoolId,
        status: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!school) {
      throw new UnprocessableEntityException({
        status: false,
        message: "Validation failed",
        errors: {
          schoolId: ["Selected school was not found"],
        },
      });
    }

    const roleSlug = this.config.get<string>("STUDENT_ROLE_SLUG") || "student";
    const studentRole = await this.prisma.role.findUnique({
      where: { slug: roleSlug },
    });

    if (!studentRole || !studentRole.status) {
      throw new InternalServerErrorException({
        status: false,
        message: `Active role with slug "${roleSlug}" was not found`,
      });
    }

    const normalizedClass = normalizeClassGrade(dto.classGrade);
    const configuredCourseIds = [
      ...new Set(courseIdsForClass(normalizedClass)),
    ];

    const courses = configuredCourseIds.length
      ? await this.prisma.course.findMany({
          where: {
            id: { in: configuredCourseIds },
            status: true,
          },
          select: {
            id: true,
            title: true,
            slug: true,
          },
        })
      : [];

    const foundCourseIds = new Set(courses.map((course) => course.id));
    const invalidCourseIds = configuredCourseIds.filter(
      (id) => !foundCourseIds.has(id),
    );

    if (invalidCourseIds.length) {
      throw new InternalServerErrorException({
        status: false,
        message: `Class ${normalizedClass} has invalid/inactive configured course IDs: ${invalidCourseIds.join(", ")}`,
      });
    }

    const password = await hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      // schoolId is intentionally NOT written to InstitutionMember.
      // Only the selected institution name is copied to users.schoolName.
      const createdUser = await tx.user.create({
        data: {
          mobile: token.mobile,
          mobile_prefix: token.mobilePrefix,
          name: dto.name.trim(),
          classGrade: normalizedClass,
          schoolName: school.name,
          rollNo: dto.rollNo.trim(),
          section: dto.section.trim(),
          userType: UserType.STUDENT,
          password,
          roles: {
            connect: { id: studentRole.id },
          },
        },
        select: this.userResponseSelect(),
      });

      if (configuredCourseIds.length) {
        await tx.userEnrolledCourse.createMany({
          data: configuredCourseIds.map((courseId) => ({
            userId: createdUser.id,
            courseId,
            sourceType: EnrollmentSource.INDIVIDUAL,
          })),
          skipDuplicates: true,
        });
      }

      return createdUser;
    });

    return {
      status: true,
      message: "Registration completed successfully",
      data: {
        user,
      },
    };
  }

  private async issueOtp(dto: SendOtpDto, isResend: boolean) {
    const mobile = this.cleanMobile(dto.mobile);
    const mobilePrefix = this.cleanPrefix(dto.mobilePrefix || "+91");
    const now = new Date();
    const resendSeconds = Number(
      this.config.get<string>("OTP_RESEND_SECONDS") || 30,
    );
    const expiryMinutes = Number(
      this.config.get<string>("OTP_EXPIRY_MINUTES") || 5,
    );

    const previous = await this.prisma.userOtp.findUnique({
      where: { mobile },
    });
    if (isResend && !previous) {
      throw new BadRequestException({
        status: false,
        message: "Please request an OTP first",
      });
    }
    const maxResends = Number(this.config.get<string>("OTP_MAX_RESENDS") || 5);

    if (isResend && previous && previous.resend >= maxResends) {
      throw new HttpException(
        {
          status: false,
          message: "Maximum resend attempts reached",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (previous) {
      const nextAllowedAt = previous.updatedAt.getTime() + resendSeconds * 1000;

      if (nextAllowedAt > now.getTime()) {
        const retryAfter = Math.ceil((nextAllowedAt - now.getTime()) / 1000);

        throw new HttpException(
          {
            status: false,
            message: `Please wait ${retryAfter} seconds before requesting another OTP`,
            errors: {
              retryAfter,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const expiresAt = new Date(now.getTime() + expiryMinutes * 60_000);

    const internationalMobile = this.msg91Mobile(mobilePrefix, mobile);

    if (isResend) {
      await this.msg91.resendOtp(internationalMobile);
    } else {
      await this.msg91.sendOtp(internationalMobile);
    }

    await this.prisma.userOtp.upsert({
      where: { mobile },
      create: {
        type: "mobile",
        mobilePrefix,
        mobile,
        code: "MSG91_MANAGED",
        resend: isResend ? 1 : 0,
        failedAttempts: 0,
        expiresAt,
      },
      update: {
        type: "mobile",
        mobilePrefix,
        code: "MSG91_MANAGED",
        resend: isResend ? { increment: 1 } : 0,
        failedAttempts: 0,
        expiresAt,
      },
    });

    return {
      status: true,
      message: isResend ? "OTP resent successfully" : "OTP sent successfully",
      data: {
        expiresInSeconds: expiryMinutes * 60,
      },
    };
  }

  private cleanMobile(value: string): string {
    let mobile = value.replace(/\D/g, "");

    // If frontend accidentally sends country code inside mobile
    // example: 919876543210
    if (mobile.length === 12 && mobile.startsWith("91")) {
      mobile = mobile.substring(2);
    }

    return mobile;
  }

  private cleanPrefix(value: string): string {
    const digits = value.replace(/\D/g, "");
    return `+${digits}`;
  }

  private msg91Mobile(prefix: string, mobile: string): string {
    return `${prefix.replace(/\D/g, "")}${mobile}`;
  }

  private createRegistrationToken(
    mobilePrefix: string,
    mobile: string,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = this.registrationTokenExpirySeconds();

    const payload: RegistrationTokenPayload = {
      type: "registration",
      mobilePrefix,
      mobile,
      iat: now,
      exp: now + expiresIn,
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    );
    const signature = this.signRegistrationPayload(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  private verifyRegistrationToken(token: string): RegistrationTokenPayload {
    const [encodedPayload, signature, ...extra] = token.split(".");

    if (!encodedPayload || !signature || extra.length) {
      throw new UnauthorizedException({
        status: false,
        message: "Invalid registration token",
      });
    }

    const expectedSignature = this.signRegistrationPayload(encodedPayload);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException({
        status: false,
        message: "Invalid registration token",
      });
    }

    let payload: RegistrationTokenPayload;

    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as RegistrationTokenPayload;
    } catch {
      throw new UnauthorizedException({
        status: false,
        message: "Invalid registration token",
      });
    }

    if (
      payload.type !== "registration" ||
      !payload.mobile ||
      !payload.mobilePrefix ||
      !payload.exp ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException({
        status: false,
        message: "Registration token is invalid or expired",
      });
    }

    return payload;
  }

  private signRegistrationPayload(payload: string): string {
    const secret = this.config.getOrThrow<string>("REGISTRATION_TOKEN_SECRET");
    return createHmac("sha256", secret).update(payload).digest("base64url");
  }

  private registrationTokenExpirySeconds(): number {
    const raw = (this.config.get<string>("REGISTRATION_TOKEN_EXPIRY") || "15m")
      .trim()
      .toLowerCase();

    if (/^\d+$/.test(raw)) {
      return Number(raw);
    }

    const match = raw.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      return 15 * 60;
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multiplier =
      unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;

    return value * multiplier;
  }

  private userResponseSelect() {
    return {
      id: true,
      uuid: true,
      name: true,
      classGrade: true,
      userType: true,
      mobile_prefix: true,
      mobile: true,
      schoolName: true,
      rollNo: true,
      section: true,
      status: true,
      roles: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    } as const;
  }
}
