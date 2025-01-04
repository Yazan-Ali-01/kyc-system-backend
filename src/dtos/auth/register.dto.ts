import { UserRole } from "@/types/user.types";
import { IsEmail, IsEnum, IsString, Matches, MinLength, IsNotEmpty } from "class-validator";

export class RegisterDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, {
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