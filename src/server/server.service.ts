import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  CreatePractitionerDto,
  CreateObservationDto,
  CreateConditionDto,
  CreateAllergyDto,
  CreateMedicationDto,
  CreateProcedureDto,
  CreateEncounterDto,
  CreateDiagnosticReportDto,
} from './dto/server.dto';

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(private prisma: PrismaService) {}

  // Patient CRUD
  async createPatient(createPatientDto: CreatePatientDto) {
    try {
      const patient = await this.prisma.patient.create({
        data: {
          ...createPatientDto,
          birthDate: createPatientDto.birthDate
            ? new Date(createPatientDto.birthDate)
            : null,
          identifiers: createPatientDto.identifiers
            ? (createPatientDto.identifiers as Prisma.InputJsonValue)
            : undefined,
        },
      });
      return patient;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Patient with epicId ${createPatientDto.epicId} already exists`,
        );
      }
      this.logger.error(`Error creating patient: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllPatients(skip = 0, take = 10) {
    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count(),
    ]);

    return { patients, total, skip, take };
  }

  async findPatientById(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        observations: true,
        conditions: true,
        allergies: true,
        medications: true,
        procedures: true,
        encounters: true,
        diagnosticReports: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return patient;
  }

  async findPatientByEpicId(epicId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { epicId },
      include: {
        observations: true,
        conditions: true,
        allergies: true,
        medications: true,
        procedures: true,
        encounters: true,
        diagnosticReports: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with Epic ID ${epicId} not found`);
    }

    return patient;
  }

  async updatePatient(id: string, updatePatientDto: UpdatePatientDto) {
    try {
      const patient = await this.prisma.patient.update({
        where: { id },
        data: {
          ...updatePatientDto,
          birthDate: updatePatientDto.birthDate
            ? new Date(updatePatientDto.birthDate)
            : undefined,
        },
      });
      return patient;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Patient with ID ${id} not found`);
      }
      this.logger.error(`Error updating patient: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deletePatient(id: string) {
    try {
      await this.prisma.patient.delete({ where: { id } });
      return { message: `Patient with ID ${id} deleted successfully` };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Patient with ID ${id} not found`);
      }
      this.logger.error(`Error deleting patient: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Practitioner CRUD
  async createPractitioner(createPractitionerDto: CreatePractitionerDto) {
    try {
      const practitioner = await this.prisma.practitioner.create({
        data: {
          ...createPractitionerDto,
          birthDate: createPractitionerDto.birthDate
            ? new Date(createPractitionerDto.birthDate)
            : null,
          prefix: createPractitionerDto.prefix || [],
          suffix: createPractitionerDto.suffix || [],
          languages: createPractitionerDto.languages || [],
          identifiers: createPractitionerDto.identifiers
            ? (createPractitionerDto.identifiers as Prisma.InputJsonValue)
            : undefined,
          telecom: createPractitionerDto.telecom
            ? (createPractitionerDto.telecom as Prisma.InputJsonValue)
            : undefined,
          address: createPractitionerDto.address
            ? (createPractitionerDto.address as Prisma.InputJsonValue)
            : undefined,
          qualifications: createPractitionerDto.qualifications
            ? (createPractitionerDto.qualifications as Prisma.InputJsonValue)
            : undefined,
        },
      });
      return practitioner;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Practitioner with epicId ${createPractitionerDto.epicId} already exists`,
        );
      }
      this.logger.error(
        `Error creating practitioner: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findAllPractitioners(skip = 0, take = 10) {
    const [practitioners, total] = await Promise.all([
      this.prisma.practitioner.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.practitioner.count(),
    ]);

    return { practitioners, total, skip, take };
  }

  async findPractitionerById(id: string) {
    const practitioner = await this.prisma.practitioner.findUnique({
      where: { id },
    });

    if (!practitioner) {
      throw new NotFoundException(`Practitioner with ID ${id} not found`);
    }

    return practitioner;
  }

  async findPractitionerByEpicId(epicId: string) {
    const practitioner = await this.prisma.practitioner.findUnique({
      where: { epicId },
    });

    if (!practitioner) {
      throw new NotFoundException(
        `Practitioner with Epic ID ${epicId} not found`,
      );
    }

    return practitioner;
  }

  // Observation CRUD
  async createObservation(createObservationDto: CreateObservationDto) {
    try {
      const observation = await this.prisma.observation.create({
        data: {
          ...createObservationDto,
          date: new Date(createObservationDto.date),
        },
      });
      return observation;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Observation with epicId ${createObservationDto.epicId} already exists`,
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(
          `Patient with ID ${createObservationDto.patientId} not found`,
        );
      }
      this.logger.error(
        `Error creating observation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findObservationsByPatientId(patientId: string) {
    return this.prisma.observation.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  // Condition CRUD
  async createCondition(createConditionDto: CreateConditionDto) {
    try {
      const condition = await this.prisma.condition.create({
        data: {
          ...createConditionDto,
          onsetDate: createConditionDto.onsetDate
            ? new Date(createConditionDto.onsetDate)
            : null,
          recordedDate: createConditionDto.recordedDate
            ? new Date(createConditionDto.recordedDate)
            : null,
        },
      });
      return condition;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Condition with epicId ${createConditionDto.epicId} already exists`,
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(
          `Patient with ID ${createConditionDto.patientId} not found`,
        );
      }
      this.logger.error(
        `Error creating condition: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findConditionsByPatientId(patientId: string) {
    return this.prisma.condition.findMany({
      where: { patientId },
      orderBy: { recordedDate: 'desc' },
    });
  }

  // Allergy CRUD
  async createAllergy(createAllergyDto: CreateAllergyDto) {
    try {
      const allergy = await this.prisma.allergy.create({
        data: {
          ...createAllergyDto,
          category: createAllergyDto.category || [],
          recordedDate: createAllergyDto.recordedDate
            ? new Date(createAllergyDto.recordedDate)
            : null,
        },
      });
      return allergy;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Allergy with epicId ${createAllergyDto.epicId} already exists`,
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(
          `Patient with ID ${createAllergyDto.patientId} not found`,
        );
      }
      this.logger.error(`Error creating allergy: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllergiesByPatientId(patientId: string) {
    return this.prisma.allergy.findMany({
      where: { patientId },
      orderBy: { recordedDate: 'desc' },
    });
  }

  // Medication CRUD
  async createMedication(createMedicationDto: CreateMedicationDto) {
    try {
      const medication = await this.prisma.medication.create({
        data: {
          ...createMedicationDto,
          startDate: createMedicationDto.startDate
            ? new Date(createMedicationDto.startDate)
            : null,
          endDate: createMedicationDto.endDate
            ? new Date(createMedicationDto.endDate)
            : null,
          dateAsserted: createMedicationDto.dateAsserted
            ? new Date(createMedicationDto.dateAsserted)
            : null,
        },
      });
      return medication;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Medication with epicId ${createMedicationDto.epicId} already exists`,
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(
          `Patient with ID ${createMedicationDto.patientId} not found`,
        );
      }
      this.logger.error(
        `Error creating medication: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findMedicationsByPatientId(patientId: string) {
    return this.prisma.medication.findMany({
      where: { patientId },
      orderBy: { startDate: 'desc' },
    });
  }

  // Procedure CRUD
  async createProcedure(createProcedureDto: CreateProcedureDto) {
    try {
      const procedure = await this.prisma.procedure.create({
        data: {
          ...createProcedureDto,
          date: createProcedureDto.date
            ? new Date(createProcedureDto.date)
            : null,
          performedDate: createProcedureDto.performedDate
            ? new Date(createProcedureDto.performedDate)
            : null,
        },
      });
      return procedure;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Procedure with epicId ${createProcedureDto.epicId} already exists`,
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(
          `Patient with ID ${createProcedureDto.patientId} not found`,
        );
      }
      this.logger.error(
        `Error creating procedure: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findProceduresByPatientId(patientId: string) {
    return this.prisma.procedure.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  // Encounter CRUD
  async createEncounter(createEncounterDto: CreateEncounterDto) {
    try {
      const encounter = await this.prisma.encounter.create({
        data: {
          ...createEncounterDto,
          startDate: createEncounterDto.startDate
            ? new Date(createEncounterDto.startDate)
            : null,
          endDate: createEncounterDto.endDate
            ? new Date(createEncounterDto.endDate)
            : null,
        },
      });
      return encounter;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Encounter with epicId ${createEncounterDto.epicId} already exists`,
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(
          `Patient with ID ${createEncounterDto.patientId} not found`,
        );
      }
      this.logger.error(
        `Error creating encounter: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findEncountersByPatientId(patientId: string) {
    return this.prisma.encounter.findMany({
      where: { patientId },
      orderBy: { startDate: 'desc' },
    });
  }

  // DiagnosticReport CRUD
  async createDiagnosticReport(
    createDiagnosticReportDto: CreateDiagnosticReportDto,
  ) {
    try {
      const diagnosticReport = await this.prisma.diagnosticReport.create({
        data: {
          ...createDiagnosticReportDto,
          date: createDiagnosticReportDto.date
            ? new Date(createDiagnosticReportDto.date)
            : null,
          effectiveDate: createDiagnosticReportDto.effectiveDate
            ? new Date(createDiagnosticReportDto.effectiveDate)
            : null,
          issuedDate: createDiagnosticReportDto.issuedDate
            ? new Date(createDiagnosticReportDto.issuedDate)
            : null,
        },
      });
      return diagnosticReport;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `DiagnosticReport with epicId ${createDiagnosticReportDto.epicId} already exists`,
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(
          `Patient with ID ${createDiagnosticReportDto.patientId} not found`,
        );
      }
      this.logger.error(
        `Error creating diagnostic report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findDiagnosticReportsByPatientId(patientId: string) {
    return this.prisma.diagnosticReport.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }
}

