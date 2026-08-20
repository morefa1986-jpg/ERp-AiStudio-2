/**
 * Fathi Aqua Super ERP Enterprise v6.0
 * Comprehensive Cross-Platform Aquaculture Management & ERP Domain Types
 */

export type LanguageCode = 'fa' | 'en' | 'de' | 'fr' | 'es' | 'ru' | 'ar';

export type TextDirection = 'rtl' | 'ltr';

export interface LanguageMeta {
  code: LanguageCode;
  name: string;
  nativeName: string;
  dir: TextDirection;
  flag: string;
  defaultCurrency: string;
  calendar: 'jalali' | 'gregorian' | 'hijri';
}

export type UserRole =
  | 'Super Admin'
  | 'Farm Owner'
  | 'Farm Manager'
  | 'Hall Manager'
  | 'Technician'
  | 'Hatchery Manager'
  | 'Laboratory'
  | 'Veterinarian'
  | 'Feed Manager'
  | 'Warehouse Manager'
  | 'Processing Manager'
  | 'Cold Storage Manager'
  | 'Accountant'
  | 'Sales Manager'
  | 'CRM Operator'
  | 'HR Manager'
  | 'Media Manager'
  | 'Viewer/Auditor';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'print'
  | 'manage';

export type PermissionModule =
  | 'dashboard'
  | 'farm'
  | 'halls'
  | 'ponds'
  | 'feeding'
  | 'biometrics'
  | 'water_quality'
  | 'mortality'
  | 'treatments'
  | 'transfers'
  | 'hatchery'
  | 'nursery'
  | 'feed_factory'
  | 'warehouse'
  | 'laboratory'
  | 'processing'
  | 'cold_storage'
  | 'crm'
  | 'sales'
  | 'accounting'
  | 'hr'
  | 'media'
  | 'ai_assistant'
  | 'reports'
  | 'backup'
  | 'users'
  | 'settings';

export interface GranularPermission {
  module: PermissionModule;
  actions: PermissionAction[];
  scope: 'all' | 'hall' | 'pond';
  scopeId?: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: GranularPermission[];
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole | string;
  customRoleId?: string;
  avatar?: string;
  isActive: boolean;
  hallScope?: string[];
  pondScope?: string[];
  preferredLanguage: LanguageCode;
  lastLoginAt?: string;
  createdAt: string;
}

export interface SturgeonSpecies {
  id: string;
  faName: string;
  enName: string;
  scientificName: string;
  origin: string;
  geneticLine: string;
  description: string;
  optimumTempMin: number;
  optimumTempMax: number;
  optimumDOMin: number;
  optimumpHMin: number;
  optimumpHMax: number;
  standardFCR: number;
  feedingProfileCoeff: number;
  caviarMaturityYears: number;
}

export type FeedingStatus = 'ACTIVE' | 'STOPPED';

export type SensorQuality = 'VALID' | 'STALE' | 'INVALID' | 'OFFLINE' | 'MANUAL';

export interface SensorMeasurement {
  sensorId: string;
  type: 'temperature' | 'do' | 'ph' | 'ammonia' | 'nitrite' | 'nitrate' | 'salinity' | 'tds' | 'turbidity';
  value: number;
  unit: string;
  timestamp: string;
  status: 'VALID' | 'STALE' | 'INVALID' | 'OFFLINE';
  quality: SensorQuality;
}

export interface Pond {
  id: string;
  number: string;
  name: string;
  hallId: string;
  capacityCubicMeters: number;
  fishCount: number;
  speciesId: string;
  speciesMix?: { speciesId: string; count: number; avgWeightKg: number }[];
  biomassKg: number;
  averageWeightKg: number;
  lastFeedingKg: number;
  lastFeedingTime: string;
  feedingStatus: FeedingStatus;
  stopFeedingReason?: 'Low Oxygen' | 'Treatment' | 'Handling' | 'Transfer' | 'Low Temperature' | 'Disease' | 'Manual Decision' | 'Other';
  stopFeedingDetails?: string;
  stopFeedingTimestamp?: string;
  stopFeedingUser?: string;
  fcr: number;
  dailyMortalityCount: number;
  waterTemperature: number;
  dissolvedOxygen: number;
  ph: number;
  activeTreatmentId?: string;
  lastBiometryDate: string;
  lastTransferDate?: string;
  criticalAlerts: string[];
  notes?: string;
}

export interface Hall {
  id: string;
  number: string;
  name: string;
  description: string;
  pondCount: number;
  totalBiomassKg: number;
  totalFishCount: number;
  managerId?: string;
  isActive: boolean;
}

export interface FeedingRecord {
  id: string;
  pondId: string;
  pondName: string;
  hallName: string;
  speciesName: string;
  biomassKg: number;
  recommendedAmountKg: number;
  actualAmountKg: number;
  unit: 'kg' | 'gram' | 'cup250g';
  feedTypeSku: string;
  feedTypeName: string;
  waterTemperature: number;
  dissolvedOxygen: number;
  feedingStatus: FeedingStatus;
  reasonIfZero?: string;
  operatorName: string;
  timestamp: string;
  notes?: string;
}

export interface BiometricSample {
  weightKg: number;
  lengthCm?: number;
}

export interface BiometricSession {
  id: string;
  pondId: string;
  pondName: string;
  speciesId: string;
  date: string;
  sampleCount: number;
  samples: BiometricSample[];
  averageWeightKg: number;
  minWeightKg: number;
  maxWeightKg: number;
  estimatedBiomassKg: number;
  estimatedCount: number;
  previousAvgWeightKg: number;
  daysSinceLastBiometry: number;
  growthRateKgPerDay: number;
  sgr: number;
  operatorName: string;
  notes?: string;
}

export interface WaterQualityLog {
  id: string;
  pondId: string;
  pondName: string;
  hallName: string;
  timestamp: string;
  temperature: number;
  dissolvedOxygen: number;
  ph: number;
  ammonia?: number;
  nitrite?: number;
  nitrate?: number;
  salinity?: number;
  tds?: number;
  turbidity?: number;
  sensorStatus: SensorQuality;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  alertMessage?: string;
  operator: string;
}

export interface MortalityRecord {
  id: string;
  pondId: string;
  pondName: string;
  speciesId: string;
  speciesName: string;
  count: number;
  estimatedWeightKg: number;
  timestamp: string;
  reason: string;
  possibleDisease?: string;
  treatmentId?: string;
  description: string;
  photoUrl?: string;
  recordedBy: string;
}

export interface TreatmentRecord {
  id: string;
  pondId: string;
  pondName: string;
  speciesName: string;
  diagnosis: string;
  drugName: string;
  dose: number;
  doseUnit: 'mg/L' | 'g/m3' | 'g/kg feed' | 'ml/m3' | 'ppm';
  administrationMethod: 'Bath (حمام)' | 'Oral (خوراکی)' | 'Injection (تزریقی)' | 'Continuous Flow';
  startDate: string;
  endDate: string;
  nextDoseDate?: string;
  veterinarian: string;
  withdrawalPeriodDays: number;
  withdrawalEndDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  reminderActive: boolean;
}

export interface FishTransfer {
  id: string;
  sourceType: 'Pond' | 'Nursery' | 'Hatchery';
  sourceId: string;
  sourceName: string;
  destinationType: 'Pond' | 'Nursery' | 'Processing' | 'Cold Storage' | 'Sale' | 'Other';
  destinationId: string;
  destinationName: string;
  speciesId: string;
  speciesName: string;
  fishCount: number;
  averageWeightKg: number;
  totalBiomassKg: number;
  date: string;
  operator: string;
  reason: string;
  status: 'COMPLETED' | 'CANCELLED';
}

export interface BroodstockFish {
  id: string;
  chipNumber: string;
  plateNumber: string;
  sex: 'Female' | 'Male' | 'Unknown';
  speciesId: string;
  speciesName: string;
  geneticLine: string;
  origin: string;
  estimatedAgeYears: number;
  weightKg: number;
  lengthCm: number;
  maturityStage: 'Stage II' | 'Stage III' | 'Stage IV (Ready)' | 'Stage V (Ovulated)' | 'Spent';
  photoUrl?: string;
  lastUltrasoundDate?: string;
  ultrasoundEggDiameterMm?: number;
  ultrasoundPolarizationIndex?: number;
  spermMotilityPercent?: number;
  spermConcentrationBillionPerMl?: number;
  status: 'Active Broodstock' | 'Resting' | 'Selected For Spawning' | 'Post Spawning' | 'Retired';
  historyNotes: string;
}

export interface FertilizationBatch {
  id: string;
  batchCode: string;
  date: string;
  femaleIds: string[];
  maleIds: string[];
  speciesId: string;
  speciesName: string;
  method: 'Artificial Dry' | 'Semi-Artificial' | 'Wet Method';
  totalEggWeightKg: number;
  estimatedEggCount: number;
  spermVolumeMl: number;
  fertilizationRatePercent: number;
  fertilizationTimestamp: string;
  incubatorId: string;
  operator: string;
  status: 'Incubating' | 'Hatched' | 'Failed';
}

export interface IncubatorUnit {
  id: string;
  code: string;
  type: 'McDonald Jar' | 'Zoug Glass' | 'Tray System' | 'Round Tank';
  currentBatchId?: string;
  eggCount: number;
  temperatureC: number;
  doMgL: number;
  waterFlowLpm: number;
  deadEggCount: number;
  fertilizationPercent: number;
  estimatedHatchPercent: number;
  hatchDateEstimated: string;
  status: 'Active' | 'Empty' | 'Sanitizing';
}

export interface LarvalBatch {
  id: string;
  batchCode: string;
  fertilizationBatchId: string;
  motherBroodstockIds: string[];
  fatherBroodstockIds: string[];
  speciesName: string;
  hatchDate: string;
  larvalCount: number;
  survivalRatePercent: number;
  deformityPercent: number;
  initialFeedType: 'Artemia Nauplii' | 'Daphnia' | 'Micro-pellet 0.2mm' | 'Larval Mash';
  currentTankId: string;
  destination: 'Nursery' | 'Fingerling Pond' | 'Sale';
  status: 'Nursery Rearing' | 'Transferred' | 'Graduated';
}

export interface NurseryTank {
  id: string;
  code: string;
  volumeLiters: number;
  currentBatchId?: string;
  fishCount: number;
  avgWeightGrams: number;
  totalBiomassGrams: number;
  feedType: string;
  dailyFeedGrams: number;
  mortalityToday: number;
  tempC: number;
  doMgL: number;
  status: 'Active' | 'Empty' | 'Cleaning';
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Feed (خوراک)' | 'Medicine & Disinfectant (دارو و ضدعفونی)' | 'Oxygen & Chemicals' | 'Packaging & Cans' | 'Equipment & Spare Parts' | 'Caviar Cans & Jars' | 'Finished Goods';
  batchNumber: string;
  quantity: number;
  unit: 'kg' | 'gram' | 'liter' | 'can' | 'piece' | 'bag';
  purchasePricePerUnit: number;
  currency: string;
  expiryDate?: string;
  supplierName: string;
  warehouseLocation: string;
  minimumStockThreshold: number;
  reorderLevel: number;
  status: 'Adequate' | 'Low Stock' | 'Critical Low' | 'Expired';
}

export type InventoryTxType =
  | 'Purchase (خرید)'
  | 'Consumption (مصرف روزانه)'
  | 'Transfer (انتقال)'
  | 'Adjustment (تعدیل موجودی)'
  | 'Return (مرجوعی)'
  | 'Waste (ضایعات)'
  | 'Production (تولید)'
  | 'Sale (فروش)';

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  type: InventoryTxType;
  quantityChange: number;
  resultingQuantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  referenceDoc?: string;
  pondId?: string;
  operator: string;
  timestamp: string;
  notes?: string;
}

export interface LabSample {
  id: string;
  sampleCode: string;
  sourceType: 'Pond' | 'Fish Tissue' | 'Water Supply' | 'Egg/Caviar' | 'Feed Batch';
  sourceName: string;
  collectionDate: string;
  collectorName: string;
  testType: 'Water Chemistry' | 'Microbiology & Bacterial' | 'Parasitology' | 'Histology' | 'Caviar Heavy Metals & Microbiology';
  parametersTested: { name: string; value: string | number; unit?: string; referenceRange: string; status: 'Normal' | 'Abnormal' | 'Critical' }[];
  resultSummary: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  attachmentUrl?: string;
}

export interface ProcessingBatch {
  id: string;
  batchCode: string;
  date: string;
  sourcePondId: string;
  sourcePondName: string;
  speciesName: string;
  fishCount: number;
  liveBiomassKg: number;
  caviarYieldKg: number;
  caviarYieldPercent: number;
  caviarGrade: 'Imperial Beluga (50g/100g)' | 'Royal Beluga' | 'Classic Baerii' | 'Asetra Gold';
  filletMeatYieldKg: number;
  filletYieldPercent: number;
  smokedMeatYieldKg: number;
  byProductAndWasteKg: number;
  operatorName: string;
  qualityScore: number;
  citesPermitNumber?: string;
  status: 'Completed' | 'Packaging' | 'Stored In Cold Room';
}

export interface ColdStoragePallet {
  id: string;
  slotCode: string;
  temperatureC: number;
  productType: 'Caviar (Cans/Jars)' | 'Frozen Sturgeon Whole' | 'Vacuumed Fillet' | 'Smoked Sturgeon' | 'Raw Broodstock Eggs';
  batchCode: string;
  weightKg: number;
  unitsCount: number;
  packagingUnit: string;
  entryDate: string;
  expiryDate: string;
  ownerCustomer?: string;
  status: 'Stored' | 'Pending Dispatch' | 'Reserved';
}

export interface Customer {
  id: string;
  name: string;
  companyName: string;
  category: 'Export Luxury Distributor' | '5-Star Hotel / Restaurant' | 'Domestic Gourmet Chain' | 'Private VIP Client' | 'Aquaculture Farm (Fingerlings)';
  phone: string;
  email: string;
  country: string;
  city: string;
  address: string;
  socialAccounts?: { instagram?: string; linkedin?: string; telegram?: string };
  outstandingBalance: number;
  currency: string;
  totalOrdersCount: number;
  totalSpent: number;
  status: 'Active VIP' | 'Regular' | 'Lead' | 'Inactive';
  notes: string;
  createdAt: string;
}

export type SalesStage =
  | 'Lead (مشتری بالقوه)'
  | 'Opportunity (مذاکره)'
  | 'Quotation (استعلام)'
  | 'Proforma (پیش‌فاکتور)'
  | 'Order Confirmed (تایید سفارش)'
  | 'Invoice Issued (صدور فاکتور)'
  | 'Payment Received (تسویه)'
  | 'Dispatched / Delivery (تحویل)'
  | 'Closed Won (موفق)'
  | 'Closed Lost (ناموفق)';

export interface ProformaItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxPercent: number;
  discount: number;
  total: number;
}

export interface ProformaInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  customerCountry: string;
  date: string;
  expiryDate: string;
  stage: SalesStage;
  items: ProformaItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency: 'USD' | 'EUR' | 'IRR' | 'RUB' | 'AED';
  paymentTerms: string;
  deliveryTerms: string;
  citesPermitRequired: boolean;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Converted to Invoice' | 'Cancelled';
}

export interface Account {
  id: string;
  code: string;
  name: string;
  faName: string;
  type: 'Asset (دارایی)' | 'Liability (بدهی)' | 'Equity (سرمایه)' | 'Revenue (درآمد)' | 'Expense (هزینه)';
  balance: number;
  currency: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  referenceType: 'Sales' | 'Purchase' | 'Payroll' | 'Processing' | 'Inventory' | 'Manual';
  referenceId?: string;
  debits: { accountId: string; accountName: string; amount: number }[];
  credits: { accountId: string; accountName: string; amount: number }[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  approvedBy?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  department: 'Production & Halls' | 'Hatchery & Genetics' | 'Processing & Cold Chain' | 'Veterinary & Lab' | 'Finance & Accounting' | 'Sales & Export' | 'Management & AI';
  phone: string;
  nationalId: string;
  contractType: 'Full-time' | 'Seasonal' | 'Contractor';
  hireDate: string;
  baseSalary: number;
  currency: string;
  bankAccount: string;
  emergencyContact: string;
  avatarUrl?: string;
  status: 'Active' | 'On Leave' | 'Terminated';
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  clockInTime: string;
  clockOutTime?: string;
  shift: 'Morning (07:00 - 15:00)' | 'Evening (15:00 - 23:00)' | 'Night Watch (23:00 - 07:00)';
  regularHours: number;
  overtimeHours: number;
  status: 'Present' | 'Late' | 'Absent' | 'Approved Leave';
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  payrollMonth: string;
  employeeId: string;
  employeeName: string;
  department: string;
  baseSalary: number;
  overtimePay: number;
  shiftBonus: number;
  hardshipAllowance: number;
  grossSalary: number;
  socialSecurityInsurance: number;
  incomeTax: number;
  loanDeduction: number;
  netPay: number;
  currency: string;
  paymentStatus: 'Calculated' | 'Approved' | 'Paid';
  paymentDate?: string;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: 'Pure Oxygen Generator / Cone' | 'Submersible Water Pump' | 'Paddlewheel Aerator' | 'Drum Filter' | 'UV Sterilizer' | 'Backup Diesel Generator' | 'Cold Room Chiller Compressor';
  hallLocation: string;
  purchaseDate: string;
  maintenanceIntervalDays: number;
  lastServiceDate: string;
  nextServiceDate: string;
  status: 'Operational' | 'Requires Service' | 'Under Maintenance' | 'Offline Failure';
  technician: string;
  totalServiceCost: number;
}

export interface SocialMediaPost {
  id: string;
  title: string;
  productType: string;
  channels: ('Instagram' | 'LinkedIn' | 'Website' | 'Telegram')[];
  textFa: string;
  textEn: string;
  textRu: string;
  textAr: string;
  hashtags: string[];
  imagePrompt: string;
  scheduledDate: string;
  status: 'Draft' | 'Approved' | 'Published' | 'Scheduled';
  aiGenerated: boolean;
}

export interface FarmAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  beforeState?: string;
  afterState?: string;
  ipAddress?: string;
}

export interface BackupSnapshot {
  id: string;
  filename: string;
  timestamp: string;
  version: string;
  dataSizeKb: number;
  tablesCount: number;
  checksum: string;
  checksumAlgorithm?: 'FNV1A32';
  schemaVersion?: number;
  creator: string;
  type: 'Automatic Daily' | 'Pre-Restore Safety Snapshot' | 'Manual Export';
  data?: Record<string, unknown>;
}

export interface ExcelImportPreviewRow {
  rowNumber: number;
  data: Record<string, any>;
  errors: string[];
  isValid: boolean;
}
