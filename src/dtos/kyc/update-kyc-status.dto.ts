import { IsEnum, IsString, Length, ValidateIf } from "class-validator";

export class UpdateKycStatusDto {
  @IsEnum(["approved", "rejected"])
  status!: "approved" | "rejected";

  @ValidateIf(o => o.status === "rejected")
  @IsString()
  @Length(0, 500)
  rejectionReason?: string;

}
