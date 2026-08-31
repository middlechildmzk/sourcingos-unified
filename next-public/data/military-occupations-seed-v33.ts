/**
 * V33 — provisional military occupation seed.
 *
 * PROVISIONAL. Every record here is marked `verified: false` on purpose.
 *
 * These entries exist so the translation engine, lanes, tests and UI have
 * something to run against before the official O*NET Military Crosswalk file is
 * imported. They were written from general public knowledge of military
 * occupation codes and have NOT been reconciled against the official file.
 *
 * The product must surface `provisionalDataInUse` wherever these are used, and
 * `importMocRows` + `mergeWithSeed` replace the authoritative fields the moment
 * the real file is loaded. Do not present provisional records to a recruiter as
 * authoritative crosswalk data.
 *
 * No private, customer, or capture content appears here.
 */

import type { CivilianOccupation, MilitaryOccupation, TaxonomyProvenance } from '@/lib/military-talent-intelligence-v33'

export const SEED_PROVENANCE: TaxonomyProvenance = {
  source: 'SourcingOS provisional development seed',
  sourceUrl: 'https://www.onetcenter.org/crosswalks.html',
  verified: false,
  version: 'seed-v33.0',
}

const seed = (occupation: Omit<MilitaryOccupation, 'provenance' | 'active'> & { active?: boolean }): MilitaryOccupation => ({
  ...occupation,
  active: occupation.active ?? true,
  provenance: SEED_PROVENANCE,
})

export const SEED_CIVILIAN_OCCUPATIONS: CivilianOccupation[] = [
  { onetSocCode: '15-1212.00', socCode: '15-1212', title: 'Information Security Analysts', alternateTitles: ['Cybersecurity Analyst', 'Security Analyst'], occupationFamily: 'Computer and Mathematical', provenance: SEED_PROVENANCE },
  { onetSocCode: '15-1244.00', socCode: '15-1244', title: 'Network and Computer Systems Administrators', alternateTitles: ['Systems Administrator', 'Network Administrator'], occupationFamily: 'Computer and Mathematical', provenance: SEED_PROVENANCE },
  { onetSocCode: '15-1241.00', socCode: '15-1241', title: 'Computer Network Architects', alternateTitles: ['Network Engineer'], occupationFamily: 'Computer and Mathematical', provenance: SEED_PROVENANCE },
  { onetSocCode: '15-1252.00', socCode: '15-1252', title: 'Software Developers', alternateTitles: ['Software Engineer'], occupationFamily: 'Computer and Mathematical', provenance: SEED_PROVENANCE },
  { onetSocCode: '15-1299.08', socCode: '15-1299', title: 'Computer Systems Engineers/Architects', alternateTitles: ['Systems Engineer'], occupationFamily: 'Computer and Mathematical', provenance: SEED_PROVENANCE },
  { onetSocCode: '33-3021.06', socCode: '33-3021', title: 'Intelligence Analysts', alternateTitles: ['All-Source Analyst'], occupationFamily: 'Protective Service', provenance: SEED_PROVENANCE },
  { onetSocCode: '29-2042.00', socCode: '29-2042', title: 'Emergency Medical Technicians', alternateTitles: ['EMT'], occupationFamily: 'Healthcare Practitioners', provenance: SEED_PROVENANCE },
  { onetSocCode: '29-1141.00', socCode: '29-1141', title: 'Registered Nurses', alternateTitles: ['RN'], occupationFamily: 'Healthcare Practitioners', provenance: SEED_PROVENANCE },
  { onetSocCode: '11-3021.00', socCode: '11-3021', title: 'Computer and Information Systems Managers', alternateTitles: ['IT Manager'], occupationFamily: 'Management', provenance: SEED_PROVENANCE },
  { onetSocCode: '13-1081.00', socCode: '13-1081', title: 'Logisticians', alternateTitles: ['Logistics Analyst', 'Supply Chain Analyst'], occupationFamily: 'Business and Financial Operations', provenance: SEED_PROVENANCE },
  { onetSocCode: '17-2199.00', socCode: '17-2199', title: 'Engineers, All Other', alternateTitles: ['Field Engineer'], occupationFamily: 'Architecture and Engineering', provenance: SEED_PROVENANCE },
]

export const SEED_MILITARY_OCCUPATIONS: MilitaryOccupation[] = [
  seed({
    branch: 'army', code: '17C', title: 'Cyber Operations Specialist (Army - Enlisted)',
    canonicalTitle: 'Cyber Operations Specialist', alternateTitles: ['Cyber Operations Specialist (Army - Enlisted)', 'Army Cyber Operations'],
    serviceCategory: 'enlisted',
    description: 'Conducts cyberspace operations including defensive cyber operations, network defense, and tool development in support of Army missions.',
    civilianOccupationCodes: ['15-1212.00', '15-1244.00'],
    skillConcepts: ['cybersecurity', 'network defense', 'incident response', 'penetration testing', 'threat hunting', 'scripting'],
    credentialSignals: ['Security+', 'CySA+', 'CEH', 'Joint Cyber Analysis Course'],
    occupationFamilies: ['cybersecurity', 'information security', 'computer network operations'],
  }),
  seed({
    branch: 'army', code: '25B', title: 'Information Technology Specialist (Army - Enlisted)',
    canonicalTitle: 'Information Technology Specialist', alternateTitles: ['Information Technology Specialist (Army - Enlisted)', '25 Bravo'],
    serviceCategory: 'enlisted',
    description: 'Maintains, processes and troubleshoots military computer systems, networks and information services.',
    civilianOccupationCodes: ['15-1244.00', '15-1241.00'],
    skillConcepts: ['system administration', 'network administration', 'help desk', 'Windows', 'Active Directory', 'infrastructure'],
    credentialSignals: ['Security+', 'Network+', 'A+'],
    occupationFamilies: ['information technology', 'systems administration', 'infrastructure'],
  }),
  seed({
    branch: 'army', code: '35F', title: 'Intelligence Analyst (Army - Enlisted)',
    canonicalTitle: 'Intelligence Analyst', alternateTitles: ['Intelligence Analyst (Army - Enlisted)', 'All-Source Intelligence Analyst'],
    serviceCategory: 'enlisted',
    description: 'Produces all-source intelligence assessments and briefings supporting operational decision making.',
    civilianOccupationCodes: ['33-3021.06'],
    skillConcepts: ['intelligence analysis', 'all-source analysis', 'threat analysis', 'reporting', 'briefing', 'research'],
    credentialSignals: ['Intelligence Analyst Course'],
    occupationFamilies: ['intelligence', 'analysis'],
  }),
  seed({
    branch: 'army', code: '68W', title: 'Combat Medic Specialist (Army - Enlisted)',
    canonicalTitle: 'Combat Medic Specialist', alternateTitles: ['Combat Medic Specialist (Army - Enlisted)', 'Healthcare Specialist'],
    serviceCategory: 'enlisted',
    description: 'Provides emergency medical treatment and evacuation support in tactical and garrison settings.',
    civilianOccupationCodes: ['29-2042.00', '29-1141.00'],
    skillConcepts: ['emergency medicine', 'patient care', 'trauma care', 'triage', 'clinical documentation'],
    credentialSignals: ['NREMT', 'EMT-B', 'BLS'],
    occupationFamilies: ['healthcare', 'emergency medicine'],
  }),
  seed({
    branch: 'army', code: '92Y', title: 'Unit Supply Specialist (Army - Enlisted)',
    canonicalTitle: 'Unit Supply Specialist', alternateTitles: ['Unit Supply Specialist (Army - Enlisted)'],
    serviceCategory: 'enlisted',
    description: 'Manages unit supply, property accountability, and logistics records.',
    civilianOccupationCodes: ['13-1081.00'],
    skillConcepts: ['logistics', 'supply chain', 'inventory management', 'property accountability', 'operations'],
    credentialSignals: [],
    occupationFamilies: ['logistics', 'operations'],
  }),
  seed({
    branch: 'air_force', code: '1D7X1', title: 'Cyber Defense Operations (Air Force - Enlisted)',
    canonicalTitle: 'Cyber Defense Operations', alternateTitles: ['Cyber Defense Operations (Air Force - Enlisted)', 'Cyber Systems Operations'],
    serviceCategory: 'enlisted',
    description: 'Operates and defends Air Force networks, systems and cyberspace weapon systems.',
    civilianOccupationCodes: ['15-1212.00', '15-1244.00'],
    skillConcepts: ['cybersecurity', 'network defense', 'system administration', 'incident response', 'vulnerability management'],
    credentialSignals: ['Security+', 'CySA+'],
    occupationFamilies: ['cybersecurity', 'information technology'],
  }),
  seed({
    branch: 'air_force', code: '1N4X1', title: 'Fusion Analyst (Air Force - Enlisted)',
    canonicalTitle: 'Fusion Analyst', alternateTitles: ['Fusion Analyst (Air Force - Enlisted)', 'Network Intelligence Analyst'],
    serviceCategory: 'enlisted',
    description: 'Analyzes and fuses multi-source intelligence data to produce assessments.',
    civilianOccupationCodes: ['33-3021.06', '15-1212.00'],
    skillConcepts: ['intelligence analysis', 'data analysis', 'signals analysis', 'reporting', 'threat analysis'],
    credentialSignals: [],
    occupationFamilies: ['intelligence', 'analysis'],
  }),
  seed({
    branch: 'navy', code: 'CTN', title: 'Cryptologic Technician Networks (Navy - Enlisted)',
    canonicalTitle: 'Cryptologic Technician Networks', alternateTitles: ['Cryptologic Technician Networks (Navy - Enlisted)', 'CTN Rating'],
    serviceCategory: 'enlisted',
    description: 'Conducts computer network operations and defensive cyberspace activities.',
    civilianOccupationCodes: ['15-1212.00'],
    skillConcepts: ['cybersecurity', 'network defense', 'computer network operations', 'threat hunting', 'digital forensics'],
    credentialSignals: ['Security+', 'CISSP'],
    occupationFamilies: ['cybersecurity', 'computer network operations'],
  }),
  seed({
    branch: 'navy', code: 'HM', title: 'Hospital Corpsman (Navy - Enlisted)',
    canonicalTitle: 'Hospital Corpsman', alternateTitles: ['Hospital Corpsman (Navy - Enlisted)', 'HM Rating'],
    serviceCategory: 'enlisted',
    description: 'Provides patient care and medical support across clinical and operational settings.',
    civilianOccupationCodes: ['29-2042.00', '29-1141.00'],
    skillConcepts: ['patient care', 'emergency medicine', 'clinical documentation', 'triage', 'medical logistics'],
    credentialSignals: ['NREMT', 'BLS'],
    occupationFamilies: ['healthcare'],
  }),
  seed({
    branch: 'marine_corps', code: '0651', title: 'Cyber Network Operator (Marine Corps - Enlisted)',
    canonicalTitle: 'Cyber Network Operator', alternateTitles: ['Cyber Network Operator (Marine Corps - Enlisted)'],
    serviceCategory: 'enlisted',
    description: 'Installs, configures and defends Marine Corps data networks.',
    civilianOccupationCodes: ['15-1244.00', '15-1212.00'],
    skillConcepts: ['network administration', 'cybersecurity', 'infrastructure', 'routing and switching', 'system administration'],
    credentialSignals: ['Security+', 'CCNA'],
    occupationFamilies: ['information technology', 'cybersecurity'],
  }),
  seed({
    branch: 'space_force', code: '5C0X1', title: 'Cyber Operations (Space Force - Enlisted)',
    canonicalTitle: 'Cyber Operations', alternateTitles: ['Cyber Operations (Space Force - Enlisted)'],
    serviceCategory: 'enlisted',
    description: 'Supports cyberspace operations for space mission systems.',
    civilianOccupationCodes: ['15-1212.00', '15-1299.08'],
    skillConcepts: ['cybersecurity', 'systems engineering', 'network defense', 'mission assurance'],
    credentialSignals: ['Security+'],
    occupationFamilies: ['cybersecurity', 'systems engineering'],
  }),
  seed({
    branch: 'coast_guard', code: 'IT', title: 'Information Systems Technician (Coast Guard - Enlisted)',
    canonicalTitle: 'Information Systems Technician', alternateTitles: ['Information Systems Technician (Coast Guard - Enlisted)', 'IT Rating'],
    serviceCategory: 'enlisted',
    description: 'Maintains information systems, networks and communications equipment.',
    civilianOccupationCodes: ['15-1244.00'],
    skillConcepts: ['system administration', 'network administration', 'communications', 'infrastructure'],
    credentialSignals: ['Security+', 'Network+'],
    occupationFamilies: ['information technology'],
  }),
  seed({
    branch: 'army', code: '255A', title: 'Information Services Technician (Army - Warrant Officer)',
    canonicalTitle: 'Information Services Technician', alternateTitles: ['Information Services Technician (Army - Warrant Officer)'],
    serviceCategory: 'warrant',
    description: 'Technical leader for Army information services, network operations and systems integration.',
    civilianOccupationCodes: ['11-3021.00', '15-1299.08'],
    skillConcepts: ['systems engineering', 'network operations', 'technical leadership', 'infrastructure', 'program management'],
    credentialSignals: ['Security+', 'PMP'],
    occupationFamilies: ['information technology', 'technical leadership'],
  }),
]
