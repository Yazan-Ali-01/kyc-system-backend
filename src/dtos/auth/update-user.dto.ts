import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsEmail(
    {},
    {
      message: "Please provide a valid email address",
    }
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, {
    message: "First name must be at least 2 characters long",
  })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, {
    message: "Last name must be at least 2 characters long",
  })
  lastName?: string;
}
