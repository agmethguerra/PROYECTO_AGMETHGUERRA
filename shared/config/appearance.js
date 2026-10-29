export const GENDERS = {
  MALE: "male",
  FEMALE: "female"
};

export const SLOTS = {
  GENDER: "gender",
  BODY: "body",
  HAIR: "hair",
  TOP: "top",
  BOTTOM: "bottom",
  SHOES: "shoes",
  ACCESSORY: "accessory"
};

export const SLOT_ORDER = ["body", "bottom", "shoes", "top", "hair", "accessory"];

export const DEFAULT_GENDER = "male";

export function isValidGender(gender) {
  return gender === GENDERS.MALE || gender === GENDERS.FEMALE;
}

export function isValidSlot(slot) {
  return Object.values(SLOTS).includes(slot);
}
