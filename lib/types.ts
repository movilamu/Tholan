export type Lang = 'en' | 'ta';
export type Theme = 'calm' | 'high_contrast' | 'dark';
export interface Profile { id:string; name:string|null; age:number|null; preferred_lang:Lang; theme:Theme; phone_number:string|null; insurance_provider:string|null; insurance_policy_number:string|null; onboarding_complete:boolean; created_at:string; }
export interface Condition { id:string; user_id:string; name:string; since:string|null; notes:string|null; created_at:string; }
export interface Medication { id:string; user_id:string; name:string; dosage:string|null; prescribed_for:string|null; added_from:'onboarding'|'record-scan'|'chatbot'|null; side_effects_reported:string|null; side_effect_action:string|null; created_at:string; }
export interface Hospital { id:string; user_id:string; name:string; phone_number:string; is_primary:boolean; scheme:'CMCHIS'|'Ayushman Bharat'|'Private'|'None'|null; created_at:string; }
export interface EmergencyContact { id:string; user_id:string; name:string; phone_number:string; relation:string|null; can_decide:boolean; created_at:string; }
export interface ChatMessage { id:string; user_id:string; role:'user'|'assistant'; content:string|null; created_at:string; }
export interface ExtractedMedication { name:string; dosage:string|null; prescribed_for:string|null; source_excerpt?:string|null; }
