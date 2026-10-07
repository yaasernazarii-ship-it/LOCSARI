import { Pool } from "pg";
import { Kysely, PostgresDialect, Generated, ColumnType } from "kysely";

export interface UsersTable {
  id: Generated<number>;
  name: string;
  phone: string;
  password_hash: string;
  status: Generated<string>;
  password_changed_at: ColumnType<Date | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OtpCodesTable {
  id: Generated<number>;
  phone: string;
  purpose: string; // registration | password_reset
  code_hash: string;
  ip: string | null;
  attempts: Generated<number>;
  expires_at: ColumnType<Date, string, never>;
  consumed_at: ColumnType<Date | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface RolesTable {
  id: Generated<number>;
  key: string;
  title_fa: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PermissionsTable {
  id: Generated<number>;
  key: string;
  description_fa: string | null;
}

export interface RolePermissionsTable {
  role_id: number;
  permission_id: number;
}

export interface UserRolesTable {
  user_id: number;
  role_id: number;
}

export interface UserPermissionsTable {
  user_id: number;
  permission_id: number;
  effect: string;
}

export interface RefreshTokensTable {
  id: Generated<number>;
  user_id: number;
  token_hash: string;
  expires_at: ColumnType<Date, string, never>;
  created_at: ColumnType<Date, string | undefined, never>;
  revoked_at: ColumnType<Date | null, string | null | undefined, string | null>;
}

export interface CategoriesTable {
  id: Generated<number>;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image: string | null;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  seo_title: string | null;
  seo_description: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CategoryFieldsTable {
  id: Generated<number>;
  category_id: number;
  key: string;
  label_fa: string;
  field_type: string;
  is_required: Generated<boolean>;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CategoryFieldOptionsTable {
  id: Generated<number>;
  field_id: number;
  value: string;
  label_fa: string;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
}

export interface ProvincesTable {
  id: Generated<number>;
  name: string;
  slug: string;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CitiesTable {
  id: Generated<number>;
  province_id: number;
  name: string;
  slug: string;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface DistrictsTable {
  id: Generated<number>;
  city_id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface SitePagesTable {
  id: Generated<number>;
  slug: string;
  title: string;
  body: string;
  video_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_published: Generated<boolean>;
  sort_order: Generated<number>;
  created_by_user_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CipPlansTable {
  id: Generated<number>;
  title: string;
  description: string;
  features: string;
  price: ColumnType<string, number | string, number | string>;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CipRequestsTable {
  id: Generated<number>;
  user_id: number;
  advertisement_id: number;
  plan_id: number;
  status: Generated<string>;
  price: ColumnType<string, number | string, number | string>;
  admin_note: string | null;
  video_url: string | null;
  assigned_consultant_id: number | null;
  assigned_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CipPaymentOrdersTable {
  id: Generated<number>;
  cip_request_id: number;
  user_id: number;
  gateway: string;
  authority: string;
  amount_rial: ColumnType<string, number | string, number | string>;
  status: Generated<string>;
  ref_id: string | null;
  card_pan: string | null;
  error_code: string | null;
  callback_payload: unknown | null;
  verify_payload: unknown | null;
  created_at: ColumnType<Date, string | undefined, never>;
  paid_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CipPageSettingsTable {
  id: Generated<number>;
  video_url: string | null;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface VipPageSettingsTable {
  id: Generated<number>;
  video_url: string | null;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface SiteContentBlocksTable {
  id: Generated<number>;
  content_key: string;
  page_key: string;
  section_key: string;
  label_fa: string;
  value: string;
  updated_by_user_id: number | null;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ContactMessagesTable {
  id: Generated<number>;
  name: string;
  phone: string;
  email: string | null;
  subject: string | null;
  message: string;
  status: Generated<string>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface SitePageImagesTable {
  id: Generated<number>;
  page_id: number;
  storage_key: string;
  url: string;
  alt_text: string | null;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface SiteContactInfoTable {
  id: Generated<number>;
  address: string | null;
  phones: Generated<string[]>;
  telegram_url: string | null;
  instagram_url: string | null;
  eitaa_url: string | null;
  whatsapp_url: string | null;
  latitude: number | null;
  longitude: number | null;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface MarketZonesTable {
  id: Generated<number>;
  city_id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface NeighborhoodsTable {
  id: Generated<number>;
  city_id: number;
  district_id: number | null;
  market_zone_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  latitude: number | null;
  longitude: number | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PropertiesTable {
  id: Generated<number>;
  category_id: number;
  subcategory_id: number | null;
  city_id: number;
  district_id: number | null;
  market_zone_id: number | null;
  neighborhood_id: number | null;
  title: string;
  description: string | null;
  area: ColumnType<string | null, number | string | null, number | string | null>;
  built_area: ColumnType<string | null, number | string | null, number | string | null>;
  land_area: ColumnType<string | null, number | string | null, number | string | null>;
  bedrooms: number | null;
  built_year: number | null;
  floor: number | null;
  total_floors: number | null;
  total_units: number | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: Generated<string>;
  duplicate_fingerprint: string | null;
  created_by_user_id: number;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PropertyAttributesTable {
  id: Generated<number>;
  property_id: number;
  field_id: number;
  value_text: string | null;
  value_number: ColumnType<string | null, number | string | null, number | string | null>;
  value_boolean: boolean | null;
  value_date: ColumnType<string | null, string | null, string | null>;
  option_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PropertyAttributeOptionsTable {
  property_id: number;
  field_id: number;
  option_id: number;
}

export interface PropertyMediaTable {
  id: Generated<number>;
  property_id: number;
  storage_key: string;
  url: string;
  alt_text: string | null;
  is_primary: Generated<boolean>;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AdvertisementsTable {
  id: Generated<number>;
  public_code: Generated<string>;
  property_id: number;
  created_by_user_id: number;
  consultant_id: number | null;
  agency_id: number | null;
  title: string;
  description: string | null;
  slug: string;
  transaction_type: string;
  price: ColumnType<string | null, number | string | null, number | string | null>;
  deposit: ColumnType<string | null, number | string | null, number | string | null>;
  monthly_rent: ColumnType<string | null, number | string | null, number | string | null>;
  status: Generated<string>;
  rejection_reason: string | null;
  is_potential_duplicate: Generated<boolean>;
  is_vip: Generated<boolean>;
  vip_expires_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  vip_video_url: string | null;
  published_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  expires_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface VipPlansTable {
  id: Generated<number>;
  title: string;
  description: string | null;
  duration_days: ColumnType<number, number | undefined, number>;
  price: ColumnType<string, number | string, number | string>;
  ad_limit: number;
  discount_percent: ColumnType<string, number | string, number | string>;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface VipSubscriptionsTable {
  id: Generated<number>;
  user_id: number;
  plan_id: number;
  agency_id: number | null;
  status: Generated<string>;
  price: ColumnType<string, number | string, number | string>;
  ad_limit: number;
  starts_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  ends_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  admin_note: string | null;
  reviewed_by: number | null;
  reviewed_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface PaymentOrdersTable {
  id: Generated<number>;
  subscription_id: number;
  user_id: number;
  gateway: string;
  authority: string;
  amount_rial: ColumnType<string, number | string, number | string>;
  status: Generated<string>;
  ref_id: string | null;
  card_pan: string | null;
  error_code: string | null;
  callback_payload: unknown | null;
  verify_payload: unknown | null;
  created_at: ColumnType<Date, string | undefined, never>;
  paid_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface VipAdAssignmentsTable {
  id: Generated<number>;
  advertisement_id: number;
  consultant_id: number | null;
  status: Generated<string>;
  result_note: string | null;
  assigned_by: number | null;
  assigned_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AdvertisementStatusHistoryTable {
  id: Generated<number>;
  advertisement_id: number;
  from_status: string | null;
  to_status: string;
  changed_by: number | null;
  reason: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PropertyDuplicateMatchesTable {
  id: Generated<number>;
  property_id: number;
  matched_property_id: number;
  advertisement_id: number | null;
  score: number;
  reason: string | null;
  status: Generated<string>;
  reviewed_by: number | null;
  reviewed_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface FavoritesTable {
  id: Generated<number>;
  user_id: number;
  advertisement_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AdvertisementInquiriesTable {
  id: Generated<number>;
  advertisement_id: number;
  user_id: number | null;
  owner_user_id: number;
  type: string;
  name: string;
  phone: string;
  message: string | null;
  preferred_date: ColumnType<string | null, string | null, string | null>;
  preferred_time: string | null;
  status: Generated<string>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AdminAuditLogsTable {
  id: Generated<number>;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number;
  meta: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface AgenciesTable {
  id: Generated<number>;
  owner_user_id: number;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  cover_image: string | null;
  address: string | null;
  city_id: number;
  district_id: number | null;
  market_zone_id: number | null;
  neighborhood_id: number | null;
  latitude: number | null;
  longitude: number | null;
  verification_status: Generated<string>;
  rejection_reason: string | null;
  suspension_reason: string | null;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ConsultantsTable {
  id: Generated<number>;
  user_id: number;
  agency_id: number | null;
  display_name: string;
  slug: string;
  bio: string | null;
  phone: string | null;
  avatar: string | null;
  license_number: string | null;
  verification_status: Generated<string>;
  rejection_reason: string | null;
  suspension_reason: string | null;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface AgencyMembershipsTable {
  id: Generated<number>;
  agency_id: number;
  user_id: number;
  consultant_id: number | null;
  membership_role: string;
  status: Generated<string>;
  invited_by_user_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface SocialLinksTable {
  id: Generated<number>;
  owner_type: string;
  owner_id: number;
  provider: string | null;
  url: string;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, string | undefined, never>;
}

// ============ CRM (فاز ۷.۲) ============

export interface CustomersTable {
  id: Generated<number>;
  user_id: number | null;
  source_lead_id: number | null;
  agency_id: number | null;
  assigned_to_user_id: number | null;
  name: string;
  mobile: string;
  email: string | null;
  national_id: string | null;
  status: Generated<string>;
  notes: string | null;
  created_by_user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CustomerTypesTable {
  id: Generated<number>;
  key: string;
  label_fa: string;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
}

export interface CustomerTypeAssignmentsTable {
  customer_id: number;
  customer_type_id: number;
}

export interface LeadsTable {
  id: Generated<number>;
  name: string;
  mobile: string;
  source: Generated<string>;
  status: Generated<string>;
  agency_id: number | null;
  assigned_to_user_id: number | null;
  notes: string | null;
  converted_customer_id: number | null;
  converted_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  created_by_user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CustomerRequirementsTable {
  id: Generated<number>;
  customer_id: number;
  category_id: number;
  transaction_type: string;
  min_price: ColumnType<string | null, number | string | null, number | string | null>;
  max_price: ColumnType<string | null, number | string | null, number | string | null>;
  min_deposit: ColumnType<string | null, number | string | null, number | string | null>;
  max_deposit: ColumnType<string | null, number | string | null, number | string | null>;
  min_monthly_rent: ColumnType<string | null, number | string | null, number | string | null>;
  max_monthly_rent: ColumnType<string | null, number | string | null, number | string | null>;
  min_area: ColumnType<string | null, number | string | null, number | string | null>;
  max_area: ColumnType<string | null, number | string | null, number | string | null>;
  bedrooms: number | null;
  status: Generated<string>;
  priority: Generated<string>;
  notes: string | null;
  assigned_to_user_id: number | null;
  created_by_user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface RequirementLocationsTable {
  id: Generated<number>;
  requirement_id: number;
  city_id: number;
  district_id: number | null;
  market_zone_id: number | null;
  neighborhood_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface RequirementAttributesTable {
  id: Generated<number>;
  requirement_id: number;
  field_id: number;
  value_text: string | null;
  value_number: ColumnType<string | null, number | string | null, number | string | null>;
  value_boolean: boolean | null;
  value_date: ColumnType<string | null, string | null, string | null>;
  option_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface RequirementAttributeOptionsTable {
  requirement_id: number;
  field_id: number;
  option_id: number;
}

export interface CrmFollowUpsTable {
  id: Generated<number>;
  lead_id: number | null;
  customer_id: number | null;
  type: Generated<string>;
  status: Generated<string>;
  scheduled_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  completed_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  notes: string | null;
  assigned_to_user_id: number | null;
  created_by_user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CrmActivitiesTable {
  id: Generated<number>;
  entity_type: string;
  entity_id: number;
  activity_type: string;
  description: string | null;
  meta: string | null;
  created_by_user_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface CrmVisitsTable {
  id: Generated<number>;
  customer_id: number;
  advertisement_id: number;
  requirement_id: number | null;
  assigned_to_user_id: number | null;
  status: Generated<string>;
  scheduled_at: ColumnType<Date, string, string>;
  completed_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  feedback: string | null;
  created_by_user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CustomerPropertyInterestsTable {
  id: Generated<number>;
  customer_id: number;
  advertisement_id: number;
  interest_level: Generated<string>;
  notes: string | null;
  created_by_user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CrmTasksTable {
  id: Generated<number>;
  title: string;
  description: string | null;
  related_entity_type: string | null;
  related_entity_id: number | null;
  status: Generated<string>;
  priority: Generated<string>;
  due_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  completed_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  assigned_to_user_id: number | null;
  created_by_user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CrmPipelinesTable {
  id: Generated<number>;
  key: string;
  title_fa: string;
  is_default: Generated<boolean>;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface CrmPipelineStagesTable {
  id: Generated<number>;
  pipeline_id: number;
  key: string;
  title_fa: string;
  sort_order: Generated<number>;
  is_won: Generated<boolean>;
  is_lost: Generated<boolean>;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface CrmPipelineCardsTable {
  id: Generated<number>;
  pipeline_id: number;
  stage_id: number;
  lead_id: number | null;
  customer_id: number | null;
  assigned_to_user_id: number | null;
  sort_order: Generated<number>;
  entered_stage_at: ColumnType<Date, string | undefined, string | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ChatThreadsTable {
  id: Generated<number>;
  advertisement_id: number;
  buyer_user_id: number;
  seller_user_id: number;
  buyer_last_read_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  seller_last_read_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  last_message_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface ChatMessagesTable {
  id: Generated<number>;
  thread_id: number;
  sender_user_id: number;
  body: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface Database {
  users: UsersTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  role_permissions: RolePermissionsTable;
  user_roles: UserRolesTable;
  user_permissions: UserPermissionsTable;
  refresh_tokens: RefreshTokensTable;
  otp_codes: OtpCodesTable;
  categories: CategoriesTable;
  category_fields: CategoryFieldsTable;
  category_field_options: CategoryFieldOptionsTable;
  provinces: ProvincesTable;
  cities: CitiesTable;
  districts: DistrictsTable;
  market_zones: MarketZonesTable;
  neighborhoods: NeighborhoodsTable;
  site_pages: SitePagesTable;
  site_content_blocks: SiteContentBlocksTable;
  site_page_images: SitePageImagesTable;
  site_contact_info: SiteContactInfoTable;
  vip_page_settings: VipPageSettingsTable;
  cip_page_settings: CipPageSettingsTable;
  cip_plans: CipPlansTable;
  cip_requests: CipRequestsTable;
  cip_payment_orders: CipPaymentOrdersTable;
  contact_messages: ContactMessagesTable;
  admin_audit_logs: AdminAuditLogsTable;
  properties: PropertiesTable;
  property_attributes: PropertyAttributesTable;
  property_attribute_options: PropertyAttributeOptionsTable;
  property_media: PropertyMediaTable;
  advertisements: AdvertisementsTable;
  advertisement_status_history: AdvertisementStatusHistoryTable;
  property_duplicate_matches: PropertyDuplicateMatchesTable;
  favorites: FavoritesTable;
  advertisement_inquiries: AdvertisementInquiriesTable;
  agencies: AgenciesTable;
  consultants: ConsultantsTable;
  agency_memberships: AgencyMembershipsTable;
  social_links: SocialLinksTable;
  customers: CustomersTable;
  customer_types: CustomerTypesTable;
  customer_type_assignments: CustomerTypeAssignmentsTable;
  leads: LeadsTable;
  customer_requirements: CustomerRequirementsTable;
  requirement_locations: RequirementLocationsTable;
  requirement_attributes: RequirementAttributesTable;
  requirement_attribute_options: RequirementAttributeOptionsTable;
  crm_follow_ups: CrmFollowUpsTable;
  crm_activities: CrmActivitiesTable;
  crm_visits: CrmVisitsTable;
  customer_property_interests: CustomerPropertyInterestsTable;
  crm_tasks: CrmTasksTable;
  crm_pipelines: CrmPipelinesTable;
  crm_pipeline_stages: CrmPipelineStagesTable;
  crm_pipeline_cards: CrmPipelineCardsTable;
  chat_threads: ChatThreadsTable;
  chat_messages: ChatMessagesTable;
  vip_plans: VipPlansTable;
  vip_subscriptions: VipSubscriptionsTable;
  payment_orders: PaymentOrdersTable;
  vip_ad_assignments: VipAdAssignmentsTable;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // اتصالات محدود برای سرور کم‌رم
  idleTimeoutMillis: 10_000, // آزادسازی سریع اتصال‌های بلااستفاده (به‌ویژه حین build که هر صفحه پول جدا می‌سازد)
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
