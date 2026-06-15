import { and, count, eq } from 'drizzle-orm';
import { ConditionOperator, TargetTable } from '../../../../apps/core-service/src/rule-builder/dto/rule-builder.dto';
import { db } from '../index';
import { findingArchetypes } from '../schema/finding_archetype';
import { riskRules, ruleCategories, ruleConditions } from '../schema/rules';

// ── Types ──────────────────────────────────────────────────────────────────

type ApplicableTheory = { law_ref: string; relevant_sentence: string; explanation: string };
type ScoreFactors = { Scope: number; Encounter: number; FinancialCost: number; BlastRadius: number; PatientHarm: number; TemporalExposure: number };
type FindingArchetypeSeed = {
  description: string;
  severityRationale: string;
  applicableTheories: ApplicableTheory[];
  scoreFactors: ScoreFactors;
};

// ── Category Definitions ──────────────────────────────────────────────────────
// All canonical rule families with their prefix identifiers.
// INTER is an alias family pointing to the same cross-state rules as TH.
export const SEED_CATEGORIES: { name: string; prefix: string; description: string }[] = [
  {
    name: 'Telehealth',
    prefix: 'TH',
    description: 'Things that go wrong specifically because the visit was virtual: prescribing without an in-person exam, providers practicing across state lines without the right license, weak consent for the video visit.',
  },
  {
    name: 'Misprescribing',
    prefix: 'MP',
    description: 'Prescribing without a documented medical reason, or prescribing doses that are dangerously high.',
  },
  {
    name: 'Controlled Substance',
    prefix: 'CS',
    description: "Problems specific to drugs the DEA controls: automatic refills, refills with no doctor involvement, prescribing that supports addiction rather than treating it.",
  },
  {
    name: 'CPOM',
    prefix: 'CPOM',
    description: 'Cases where a company (rather than a licensed doctor) is effectively making clinical decisions, owns more of the practice than the law allows, or is splitting fees in ways that compromise care.',
  },
  {
    name: 'Documentation',
    prefix: 'DOC',
    description: 'Cases where the medical record itself is incomplete — missing notes, missing screenings.',
  },
  {
    name: 'Supervision',
    prefix: 'SUP',
    description: 'Nurse practitioners or physician assistants working outside the supervision rules of their state.',
  },
  {
    name: 'Interstate',
    prefix: 'INTER',
    description: 'Older name for the cross-state licensure problem; kept as an alias so existing reports do not break.',
  },
  {
    name: 'Multi-family Composite',
    prefix: 'F',
    description: 'A pattern that touches more than one family at once.',
  },
];

// ── Rule Definitions ──────────────────────────────────────────────────────────
export const SEED_RULES: {
  category: string;
  code: string;
  name: string;
  severity: string;
  targetTable: TargetTable;
  conditions: { fieldName: string; operator: ConditionOperator; value: string | null }[];
  findingArchetype: FindingArchetypeSeed;
}[] = [
  // 1. Telehealth
  {
    category: 'Telehealth',
    code: 'TH-001',
    name: 'Ryan Haight Act Violation',
    severity: 'CRITICAL',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'is_telehealth', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'controlled_substance_prescribed', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'patient_identity_verified', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'telehealth_id', operator: ConditionOperator.IS_NOT_NULL, value: null },
    ],
    findingArchetype: {
      description: 'A telehealth provider prescribed a controlled substance without verifying the patient\'s identity or establishing a prior in-person relationship, violating the Ryan Haight Online Pharmacy Consumer Protection Act. This touches both the telehealth and controlled-substance rule families.',
      severityRationale: 'Rated Critical because federal criminal exposure under 21 U.S.C. § 831 applies when controlled substances are prescribed via the Internet without a valid prescription-patient relationship. Escalates further if the patient experienced an adverse event or if the provider issued a high volume of such prescriptions.',
      applicableTheories: [
        {
          law_ref: '21 U.S.C. § 831 (Ryan Haight Act)',
          relevant_sentence: 'It shall be unlawful to deliver, distribute, or dispense a controlled substance by means of the Internet without a valid prescription.',
          explanation: 'Provider prescribed a controlled substance via telehealth without conducting or documenting an in-person medical evaluation, making the prescription invalid under federal law.',
        },
        {
          law_ref: '21 C.F.R. § 1306.04(a)',
          relevant_sentence: 'A prescription for a controlled substance to be effective must be issued for a legitimate medical purpose by an individual practitioner acting in the usual course of his professional practice.',
          explanation: 'Absence of patient identity verification undermines the legitimacy of the prescription and the practitioner\'s authority to prescribe.',
        },
      ],
      scoreFactors: { Scope: 5, Encounter: 8, FinancialCost: 9, BlastRadius: 6, PatientHarm: 7, TemporalExposure: 5 },
    },
  },
  {
    category: 'Telehealth',
    code: 'TH-002',
    name: 'Cross-State Licensure Violation',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'is_telehealth', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'cross_state_flag', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'cross_state_license', operator: ConditionOperator.EQUALS, value: 'false' },
    ],
    findingArchetype: {
      description: 'A provider delivered telehealth services to a patient located in a state where the provider is not licensed, violating that state\'s medical practice act. This is a telehealth and interstate licensure issue.',
      severityRationale: 'Rated High because practicing medicine without a license is a criminal offense in most states. Escalates to Critical if the provider also prescribed controlled substances across state lines, or if the unlicensed practice directly caused patient harm.',
      applicableTheories: [
        {
          law_ref: 'State Medical Practice Acts (model)',
          relevant_sentence: 'No person shall practice medicine without a valid license issued by the medical board of this state.',
          explanation: 'Provider treated a patient physically located in a state for which the provider holds no active license.',
        },
        {
          law_ref: 'FSMB Telemedicine Policy (2014)',
          relevant_sentence: 'The state where the patient is located at the time of the telehealth encounter is generally the state that has jurisdiction over the practice of medicine.',
          explanation: 'Cross-state flag confirms the patient was in a different state than the provider\'s licensed jurisdiction at the time of the encounter.',
        },
      ],
      scoreFactors: { Scope: 4, Encounter: 6, FinancialCost: 7, BlastRadius: 7, PatientHarm: 4, TemporalExposure: 6 },
    },
  },
  {
    category: 'Telehealth',
    code: 'TH-003',
    name: 'Inadequate Telehealth Consent',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'is_telehealth', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'consent_obtained', operator: ConditionOperator.EQUALS, value: 'false' },
      { fieldName: 'informed_consent_type', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'session_recording_consent', operator: ConditionOperator.IS_NULL, value: null },
    ],
    findingArchetype: {
      description: 'The provider conducted a telehealth encounter without obtaining documented informed consent for the telehealth modality or session recording. This is a telehealth and documentation compliance issue.',
      severityRationale: 'Rated High because unconsented telehealth visits expose the provider to HIPAA violations and state tort liability. Escalates to Critical if the session was recorded without patient consent, triggering wiretapping statutes in two-party consent states.',
      applicableTheories: [
        {
          law_ref: '45 C.F.R. § 164.508 (HIPAA)',
          relevant_sentence: 'Covered entities must obtain a valid authorization for any use or disclosure of protected health information that is not otherwise permitted by this subpart.',
          explanation: 'Recording or transmitting session data without documented consent violates HIPAA authorization requirements.',
        },
        {
          law_ref: 'State Telehealth Consent Statutes (model)',
          relevant_sentence: 'Prior to providing telehealth services, the provider shall obtain patient consent specific to the telehealth modality and document such consent in the medical record.',
          explanation: 'No consent form or acknowledgment was documented in the patient record for either the telehealth modality or session recording.',
        },
      ],
      scoreFactors: { Scope: 4, Encounter: 5, FinancialCost: 6, BlastRadius: 6, PatientHarm: 3, TemporalExposure: 4 },
    },
  },

  // 2. Misprescribing
  {
    category: 'Misprescribing',
    code: 'MP-001',
    name: 'Prescribing Without Indication',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'medication_prescribed', operator: ConditionOperator.IS_NOT_NULL, value: null },
      { fieldName: 'primary_diagnosis', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'clinical_notes_completed', operator: ConditionOperator.EQUALS, value: 'false' },
    ],
    findingArchetype: {
      description: 'A provider prescribed a medication without documenting a primary diagnosis or completing clinical notes, meaning there is no recorded medical justification for the prescription. This is a misprescribing and documentation issue.',
      severityRationale: 'Rated High because prescribing without a documented indication violates professional prescribing standards and opens the provider to disciplinary action and civil liability. Escalates to Critical if the medication is a controlled substance, triggering federal prescribing regulations.',
      applicableTheories: [
        {
          law_ref: '21 C.F.R. § 1306.04(a)',
          relevant_sentence: 'A prescription for a controlled substance to be effective must be issued for a legitimate medical purpose by an individual practitioner acting in the usual course of his professional practice.',
          explanation: 'No primary diagnosis on file means no documented legitimate medical purpose exists for the prescription.',
        },
        {
          law_ref: 'AMA Code of Medical Ethics Opinion 9.6.9',
          relevant_sentence: 'Physicians must prescribe medications only when there is a medical indication for their use and must document that indication.',
          explanation: 'Prescribing without a recorded diagnosis violates foundational prescribing ethics and applicable professional standards of care.',
        },
      ],
      scoreFactors: { Scope: 4, Encounter: 6, FinancialCost: 7, BlastRadius: 5, PatientHarm: 6, TemporalExposure: 4 },
    },
  },
  {
    category: 'Misprescribing',
    code: 'MP-002',
    name: 'Dangerous Overdosing',
    severity: 'CRITICAL',
    targetTable: TargetTable.MEDICATION_ANALYTICS,
    conditions: [
      { fieldName: 'controlled_substance', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'substance_quantity', operator: ConditionOperator.GREATER_THAN, value: '120' },
    ],
    findingArchetype: {
      description: 'A provider prescribed a controlled substance in a quantity exceeding 120 units, a threshold associated with addiction risk and heightened DEA scrutiny. This is both a misprescribing and a controlled-substance issue.',
      severityRationale: 'Rated Critical because high-dose controlled-substance prescriptions are a leading indicator of diversion and patient harm, and exceed CDC safe-prescribing guidance. Escalates further if the patient had prior CDS alerts, a documented addiction history, or if the prescription resulted in an adverse event.',
      applicableTheories: [
        {
          law_ref: '21 U.S.C. § 842(a)(1)',
          relevant_sentence: 'It shall be unlawful for any person to distribute or dispense a controlled substance in violation of section 829 of this title.',
          explanation: 'Prescribing quantities beyond clinically defensible thresholds suggests distribution rather than legitimate medical treatment, which violates the Controlled Substances Act.',
        },
        {
          law_ref: 'DEA Practitioner\'s Manual § 4.4',
          relevant_sentence: 'A practitioner must not dispense a quantity of a controlled substance that exceeds the amount consistent with the legitimate medical needs of the patient.',
          explanation: 'Substance quantity exceeding 120 units without documented clinical justification exceeds DEA safe-prescribing guidance.',
        },
        {
          law_ref: 'CDC Clinical Practice Guideline for Prescribing Opioids (2022)',
          relevant_sentence: 'Clinicians should use the lowest effective dosage and should carefully reassess evidence of individual benefits and risks when considering increasing dosage.',
          explanation: 'Prescribing above guideline thresholds without documented risk-benefit assessment contradicts CDC evidence-based prescribing standards.',
        },
      ],
      scoreFactors: { Scope: 3, Encounter: 8, FinancialCost: 9, BlastRadius: 4, PatientHarm: 9, TemporalExposure: 5 },
    },
  },
  {
    category: 'Misprescribing',
    code: 'MP-003',
    name: 'Inadequate Medical Assessment',
    severity: 'MEDIUM',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'session_duration', operator: ConditionOperator.LESS_THAN, value: '30' },
      { fieldName: 'mental_health_screening', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'substance_use_screening', operator: ConditionOperator.IS_NULL, value: null },
    ],
    findingArchetype: {
      description: 'A provider completed a visit in under 30 minutes without performing mental health or substance use screenings, suggesting an insufficient clinical assessment before prescribing. This is a misprescribing and documentation issue.',
      severityRationale: 'Rated Medium because short encounters without required screenings indicate systemic corner-cutting rather than isolated error. Escalates to High if the provider also prescribed a controlled substance during the abbreviated encounter, or if the pattern recurs across a high volume of patients.',
      applicableTheories: [
        {
          law_ref: 'SAMHSA Treatment Improvement Protocol (TIP) 63',
          relevant_sentence: 'Treatment programs must conduct a comprehensive assessment of each patient\'s substance use history and mental health status prior to prescribing.',
          explanation: 'No mental health or substance use screening was documented before prescribing, violating SAMHSA assessment requirements.',
        },
        {
          law_ref: 'State Medical Board Standards of Care (model)',
          relevant_sentence: 'A physician shall conduct a thorough history and physical examination appropriate to the patient\'s condition before initiating any course of treatment.',
          explanation: 'A session under 30 minutes without any documented screenings does not meet the minimum standard-of-care evaluation requirements.',
        },
      ],
      scoreFactors: { Scope: 5, Encounter: 5, FinancialCost: 5, BlastRadius: 7, PatientHarm: 5, TemporalExposure: 6 },
    },
  },

  // 3. Controlled Substance
  {
    category: 'Controlled Substance',
    code: 'CS-001',
    name: 'Auto-Refill Violation',
    severity: 'HIGH',
    targetTable: TargetTable.MEDICATION_ANALYTICS,
    conditions: [
      { fieldName: 'controlled_substance_prescribed', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'auto_refill_enabled', operator: ConditionOperator.EQUALS, value: 'true' },
    ],
    findingArchetype: {
      description: 'The platform or practice enabled automatic refills on a controlled substance prescription, bypassing the legal requirement for provider review and authorization before each refill. This is a controlled-substance and corporate practice-of-medicine issue.',
      severityRationale: 'Rated High because automated controlled-substance refills violate DEA regulations and most state pharmacy laws. Escalates to Critical if the patient is flagged for addiction risk, if the auto-refill has operated for an extended period, or if a corporate mandate drove the policy.',
      applicableTheories: [
        {
          law_ref: '21 C.F.R. § 1306.12(a)',
          relevant_sentence: 'No prescription for a controlled substance in Schedule III or IV shall be filled or refilled more than five times, or later than six months after the date thereof, whichever occurs first.',
          explanation: 'Auto-refill enables refills without per-fill provider authorization, violating the requirement for individual practitioner approval before each controlled-substance refill.',
        },
        {
          law_ref: 'DEA Practitioner\'s Manual § 6.1',
          relevant_sentence: 'Each refill of a Schedule III or IV controlled substance requires the prescribing practitioner\'s express authorization.',
          explanation: 'An automated system issuing refills removes the required practitioner decision-making from the refill process.',
        },
      ],
      scoreFactors: { Scope: 7, Encounter: 5, FinancialCost: 7, BlastRadius: 8, PatientHarm: 6, TemporalExposure: 7 },
    },
  },
  {
    category: 'Controlled Substance',
    code: 'CS-002',
    name: 'Refill Without Medical Oversight',
    severity: 'HIGH',
    targetTable: TargetTable.MEDICATION_ANALYTICS,
    conditions: [
      { fieldName: 'refill_count', operator: ConditionOperator.GREATER_THAN, value: '2' },
      { fieldName: 'follow_up_scheduled', operator: ConditionOperator.EQUALS, value: 'false' },
      { fieldName: 'vital_signs_recorded', operator: ConditionOperator.IS_NULL, value: null },
    ],
    findingArchetype: {
      description: 'A controlled substance was refilled more than twice without a scheduled follow-up appointment or recorded vital signs, indicating ongoing prescribing with no documented clinical monitoring. This is a controlled-substance and documentation issue.',
      severityRationale: 'Rated High because repeated refills without oversight are a recognized red flag for prescriber-facilitated diversion or patient addiction. Escalates to Critical if the patient has a documented history of substance abuse, if no follow-up was ever completed, or if the refill pattern spans more than six months.',
      applicableTheories: [
        {
          law_ref: '21 C.F.R. § 1306.12(b)',
          relevant_sentence: 'No controlled substance in Schedule III or IV may be filled or refilled more than 6 months after the date the prescription was issued or more than five times, whichever occurs first.',
          explanation: 'Multiple refills without documented clinical monitoring and without a follow-up appointment exceed safe prescribing standards and create diversion risk.',
        },
        {
          law_ref: 'State Medical Board Controlled Substance Prescribing Guidelines (model)',
          relevant_sentence: 'Providers must conduct in-person or telehealth follow-up evaluations at clinically appropriate intervals for patients on chronic controlled substance therapy.',
          explanation: 'No follow-up scheduled and no vital signs recorded demonstrate the absence of required ongoing clinical oversight for a patient receiving repeated controlled-substance refills.',
        },
      ],
      scoreFactors: { Scope: 4, Encounter: 6, FinancialCost: 7, BlastRadius: 6, PatientHarm: 7, TemporalExposure: 7 },
    },
  },
  {
    category: 'Controlled Substance',
    code: 'CS-003',
    name: 'Patient Addiction Facilitation',
    severity: 'CRITICAL',
    targetTable: TargetTable.MEDICATION_ANALYTICS,
    conditions: [
      { fieldName: 'controlled_substance', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'substance_quantity', operator: ConditionOperator.GREATER_THAN, value: '90' },
      { fieldName: 'cds_alert_count', operator: ConditionOperator.GREATER_THAN, value: '0' },
      { fieldName: 'override_reason', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'medication_adherence', operator: ConditionOperator.EQUALS, value: 'Unknown' },
    ],
    findingArchetype: {
      description: 'A provider prescribed a high-quantity controlled substance, overrode a clinical decision support alert without documenting a reason, and the patient\'s medication adherence is unknown — a pattern consistent with prescribing to support addiction rather than treat a clinical condition. This touches controlled substances, misprescribing, and patient safety.',
      severityRationale: 'Rated Critical because this pattern matches the DEA\'s profile of a pill-mill prescriber and creates both federal criminal and state civil exposure. Escalates further if the patient subsequently suffered an overdose, if the provider has a pattern of similar undocumented overrides across multiple patients, or if diversion is suspected.',
      applicableTheories: [
        {
          law_ref: '21 U.S.C. § 841(a)(1)',
          relevant_sentence: 'Except as authorized by this subchapter, it shall be unlawful for any person knowingly or intentionally to manufacture, distribute, or dispense, or possess with intent to distribute or dispense, a controlled substance.',
          explanation: 'Overriding CDS alerts without documentation and prescribing beyond therapeutic thresholds supports a distribution charge rather than a legitimate treatment defense under the Controlled Substances Act.',
        },
        {
          law_ref: '21 C.F.R. § 1306.04(a)',
          relevant_sentence: 'A prescription issued not in the usual course of professional treatment or in legitimate and authorized research is not a valid prescription within the meaning and intent of section 829 of this title.',
          explanation: 'Unknown medication adherence combined with high quantity and ignored alerts demonstrates the prescription is not issued in the usual course of professional treatment.',
        },
        {
          law_ref: 'CDC Clinical Practice Guideline for Prescribing Opioids (2022)',
          relevant_sentence: 'Clinicians should use the lowest effective dosage and should carefully reassess evidence of individual benefits and risks when considering increasing dosage to ≥50 morphine milligram equivalents per day.',
          explanation: 'Prescribing above 90 MME without adherence monitoring or documented risk-benefit assessment directly contradicts CDC evidence-based prescribing guidance.',
        },
      ],
      scoreFactors: { Scope: 4, Encounter: 9, FinancialCost: 10, BlastRadius: 5, PatientHarm: 10, TemporalExposure: 6 },
    },
  },

  // 4. CPOM
  {
    category: 'CPOM',
    code: 'CPOM-001',
    name: 'Corporate Clinical Interference',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'clinical_protocol_approved_by', operator: ConditionOperator.NOT_IN, value: 'MD,DO,NP,PA,Physician,Licensed Physician,Nurse Practitioner,Physician Assistant' },
      { fieldName: 'auto_refill_policy_corporate_mandated', operator: ConditionOperator.EQUALS, value: 'true' },
    ],
    findingArchetype: {
      description: 'Clinical protocols were approved by a non-licensed individual and the platform mandated auto-refill policies, meaning a corporation rather than a licensed clinician is directing medical decisions. This is a corporate practice of medicine (CPOM) issue that may also implicate controlled-substance regulations.',
      severityRationale: 'Rated High because corporate clinical interference violates CPOM doctrine in most states and exposes both the company and its affiliated physicians to licensure revocation and civil penalties. Escalates to Critical if the corporate-mandated protocol directly harmed patients or if it governed the prescribing of controlled substances.',
      applicableTheories: [
        {
          law_ref: 'California Business & Professions Code § 2400',
          relevant_sentence: 'Corporations and other artificial legal entities shall have no professional rights, privileges, or powers.',
          explanation: 'Non-physician approval of clinical protocols and a corporate-mandated auto-refill policy constitute unlawful corporate practice of medicine under California law and analogous state statutes.',
        },
        {
          law_ref: 'Texas Medical Board Rules § 179.1 (model CPOM rule)',
          relevant_sentence: 'No business entity shall practice medicine, employ a physician to practice medicine, or otherwise interfere with the independent medical judgment of a physician.',
          explanation: 'Corporate-mandated auto-refill policies override physician judgment in a way that constitutes prohibited interference with independent medical decision-making.',
        },
      ],
      scoreFactors: { Scope: 8, Encounter: 5, FinancialCost: 8, BlastRadius: 9, PatientHarm: 5, TemporalExposure: 7 },
    },
  },
  {
    category: 'CPOM',
    code: 'CPOM-002',
    name: 'Inadequate Physician Ownership',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'physician_ownership_percentage', operator: ConditionOperator.LESS_THAN, value: '51' },
      { fieldName: 'corporate_structure', operator: ConditionOperator.EQUALS, value: 'PE-Backed' },
    ],
    findingArchetype: {
      description: 'A private-equity-backed entity owns more than 49% of the medical practice, violating most states\' requirement that physicians own a majority stake in any medical corporation. This is a CPOM and corporate structure issue with broad structural implications.',
      severityRationale: 'Rated High because inadequate physician ownership can invalidate the medical practice\'s corporate structure, void all clinical contracts, and result in injunctions and civil penalties. Escalates to Critical if the corporate parent has actively directed clinical decisions or if regulators have opened an investigation.',
      applicableTheories: [
        {
          law_ref: 'California Corporations Code § 13401.5',
          relevant_sentence: 'A professional corporation for the practice of medicine shall have at least one shareholder, officer, and director who is a licensed physician and surgeon.',
          explanation: 'PE-backed structure with physician ownership below 51% fails the majority-physician-ownership requirement and may render the corporate entity\'s medical practice unlicensed.',
        },
        {
          law_ref: 'New York Education Law § 6507(4)(c) (model)',
          relevant_sentence: 'No corporation, lay person, or other entity not licensed to practice medicine shall own or control a medical practice.',
          explanation: 'Corporate ownership exceeding 49% transfers effective control of the practice to non-physician investors, violating the prohibition on lay ownership of medical practices.',
        },
      ],
      scoreFactors: { Scope: 8, Encounter: 3, FinancialCost: 8, BlastRadius: 9, PatientHarm: 3, TemporalExposure: 8 },
    },
  },

  // 5. Documentation
  {
    category: 'Documentation',
    code: 'DOC-001',
    name: 'Missing Clinical Documentation',
    severity: 'MEDIUM',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'clinical_notes_completed', operator: ConditionOperator.EQUALS, value: 'false' },
      { fieldName: 'note_signed_date', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'chief_complaint', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'allergies_reviewed', operator: ConditionOperator.IS_NULL, value: null },
    ],
    findingArchetype: {
      description: 'The clinical encounter record lacks a signed note, chief complaint, and allergy review, meaning the medical record is materially incomplete and does not meet minimum documentation standards. This is a documentation issue with billing and liability implications.',
      severityRationale: 'Rated Medium because incomplete documentation is a standard-of-care violation and a billing compliance risk that can trigger CMS audits. Escalates to High if the encounter involved a controlled substance prescription, or if the missing documentation appears to conceal a patient safety event.',
      applicableTheories: [
        {
          law_ref: '42 C.F.R. § 482.24(c)(2)',
          relevant_sentence: 'Medical records must contain information to justify the admission and continued hospitalization, support the diagnosis, and describe the patient\'s progress and response to medications and services.',
          explanation: 'Missing signed note, chief complaint, and allergy review fail the federal minimum medical record content requirements applicable to providers participating in Medicare and Medicaid.',
        },
        {
          law_ref: 'AMA Code of Medical Ethics Opinion 3.3.1',
          relevant_sentence: 'Physicians have an ethical obligation to maintain accurate, complete, and timely medical records.',
          explanation: 'A record lacking a signed note and chief complaint does not constitute an accurate and complete record as required by AMA ethical standards and state medical board rules.',
        },
      ],
      scoreFactors: { Scope: 5, Encounter: 4, FinancialCost: 5, BlastRadius: 6, PatientHarm: 4, TemporalExposure: 5 },
    },
  },
  {
    category: 'Documentation',
    code: 'DOC-002',
    name: 'Inadequate Screening Documentation',
    severity: 'MEDIUM',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'mental_health_screening', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'substance_use_screening', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'allergies_reviewed', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'technology_assessment', operator: ConditionOperator.IS_NULL, value: null },
    ],
    findingArchetype: {
      description: 'The encounter record contains no mental health screenings, substance use screenings, allergy review, or technology assessment, indicating that required pre-prescribing assessments were either not performed or not documented. This is a documentation and misprescribing issue.',
      severityRationale: 'Rated Medium because absent screening documentation is a systematic quality gap that exposes the practice to payer audits and standard-of-care claims. Escalates to High if controlled substances were prescribed without these screenings, or if the pattern appears across a significant volume of encounters.',
      applicableTheories: [
        {
          law_ref: 'SAMHSA TIP 63 — Medications for Opioid Use Disorder',
          relevant_sentence: 'Clinicians should document all screening results in the medical record at each visit for patients receiving medications for opioid use disorder or other controlled substance therapy.',
          explanation: 'No substance use or mental health screening documented for a patient on controlled substances violates SAMHSA documentation standards.',
        },
        {
          law_ref: 'CMS Conditions of Participation § 482.13(b)(2)',
          relevant_sentence: 'The patient has the right to receive care in a safe setting; providers must assess and document all relevant clinical factors before initiating treatment.',
          explanation: 'Missing mental health, substance use, allergy, and technology assessments constitute incomplete clinical risk documentation that fails CMS conditions of participation.',
        },
      ],
      scoreFactors: { Scope: 5, Encounter: 4, FinancialCost: 4, BlastRadius: 6, PatientHarm: 4, TemporalExposure: 5 },
    },
  },
];

// ── seedOrgRules ──────────────────────────────────────────────────────────────

export async function seedOrgRules(org: { id: string; name: string }, clean = false) {
  const orgId = org.id;
  console.log(`\n🚀 Seeding precise rules for: ${org.name} (${orgId})...`);

  if (clean) {
    // Wipe existing data for this org before re-seeding
    await db.delete(findingArchetypes).where(eq(findingArchetypes.organizationId, orgId));
    await db.delete(ruleConditions).where(eq(ruleConditions.organizationId, orgId));
    await db.delete(riskRules).where(eq(riskRules.organizationId, orgId));
    await db.delete(ruleCategories).where(eq(ruleCategories.organizationId, orgId));
  } else {
    const [{ value }] = await db.select({ value: count() }).from(riskRules).where(eq(riskRules.organizationId, orgId));
    if (value > 0) {
      console.log(`⚠️  Skipping ${org.name}: ${value} rule(s) already exist. Re-run with clean = true to replace them.`);
      return;
    }
  }

  const categoryCache = new Map<string, string>();
  const categorySerialMap = new Map<string, number>();
  let rulesCount = 0;
  let conditionsCount = 0;
  let archetypesCount = 0;

  // 0. Seed all canonical categories (incl. SUP, INTER, F with no rules yet)
  for (const catDef of SEED_CATEGORIES) {
    const [newCat] = await db.insert(ruleCategories).values({
      organizationId: orgId,
      name: catDef.name,
      prefix: catDef.prefix,
      description: catDef.description,
    }).returning();
    categoryCache.set(catDef.name, newCat.id);
  }

  for (const ruleDef of SEED_RULES) {
    // 1. Category (already seeded above; look up from cache or fall back to insert)
    if (!categoryCache.has(ruleDef.category)) {
      const [existingCat] = await db.select()
        .from(ruleCategories)
        .where(
          and(
            eq(ruleCategories.name, ruleDef.category),
            eq(ruleCategories.organizationId, orgId)
          )
        )
        .limit(1);

      if (existingCat) {
        categoryCache.set(ruleDef.category, existingCat.id);
      } else {
        const prefix = SEED_CATEGORIES.find(c => c.name === ruleDef.category)?.prefix ?? ruleDef.category.toUpperCase();
        const [newCat] = await db.insert(ruleCategories).values({
          organizationId: orgId,
          name: ruleDef.category,
          prefix,
        }).returning();
        categoryCache.set(ruleDef.category, newCat.id);
      }
    }
    const catId = categoryCache.get(ruleDef.category)!;

    // 2. Rule
    const ruleSerial = (categorySerialMap.get(catId) ?? 0) + 1;
    categorySerialMap.set(catId, ruleSerial);
    const [newRule] = await db.insert(riskRules).values({
      organizationId: orgId,
      categoryId: catId,
      ruleName: ruleDef.name,
      ruleCode: ruleDef.code,
      targetTable: ruleDef.targetTable,
      severity: ruleDef.severity as any,
      serial: ruleSerial,
      isActive: true,
    }).returning();
    rulesCount++;

    // 3. Conditions
    let conditionOrder = 0;
    for (const cond of ruleDef.conditions) {
      await db.insert(ruleConditions).values({
        ruleId: newRule.id,
        organizationId: orgId,
        fieldName: cond.fieldName,
        operator: cond.operator,
        value: cond.value,
        logicalOperator: 'AND',
        order: conditionOrder++,
      });
      conditionsCount++;
    }

    // 4. Finding Archetype
    const arch = ruleDef.findingArchetype;
    await db.insert(findingArchetypes).values({
      organizationId: orgId,
      ruleId: newRule.id,
      description: arch.description,
      severityRationale: arch.severityRationale,
      applicableTheories: arch.applicableTheories,
      scoreFactors: arch.scoreFactors,
      serial: ruleSerial,
      catalogId: ruleDef.code,
    });
    archetypesCount++;
  }

  console.log(`✅ Seeded ${rulesCount} rules, ${conditionsCount} conditions, and ${archetypesCount} finding archetypes for ${org.name}`);
}
