import { UserRole } from "@/types/user.types";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsNotEmpty()
  @IsEmail({}, { message: "Invalid email provided" })
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, {
    message: "Password must be at least 8 characters long",
  })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+]+$/, {
    message: "Password must contain at least one letter and one number",
  })
  password!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2, {
    message: "First name must be at least 2 characters long",
  })
  firstName!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2, {
    message: "Last name must be at least 2 characters long",
  })
  lastName!: string;

  @IsEnum(UserRole, {
    message: "Invalid role provided",
  })
  role: UserRole = UserRole.USER;
}
