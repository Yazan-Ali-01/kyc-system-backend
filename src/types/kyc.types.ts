export type KycStatus = "pending" | "approved" | "rejected";

export enum IdDocumentType {
  PASSPORT = "passport",
  NATIONAL_ID = "nationalId",
  DRIVING_LICENSE = "drivingLicense",
}

export interface KycSubmissionDto {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  idDocumentType: IdDocumentType;
  idDocumentNumber: string;
}

export interface KycUpdateDto {
  status: KycStatus;
  rejectionReason?: string;
}

export interface KycResponse {
  id: string;
  userId: string;
  status: KycStatus;
  submissionDate: Date;
  lastUpdated: Date;
  firstName: string;
  lastName: string;
  idDocumentType: IdDocumentType;
  documentVerified: boolean;
}
