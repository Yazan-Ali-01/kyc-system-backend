import { IdDocumentType } from "@/types/kyc.types";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from "class-validator";

class AddressDto {
  @IsString()
  @Length(1, 100)
  street!: string;

  @IsString()
  @Length(1, 50)
  city!: string;

  @IsString()
  @Length(1, 50)
  state!: string;

  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  country!: string;

  @IsString()
  @Length(1, 20)
  postalCode!: string;
}

export class SubmitKycDto {
  @IsString()
  @Length(1, 50)
  firstName!: string;

  @IsString()
  @Length(1, 50)
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsEnum(IdDocumentType)
  idDocumentType!: IdDocumentType;

  @IsString()
  @Length(5, 30)
  idDocumentNumber!: string;
}
