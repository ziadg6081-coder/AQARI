// Egypt - 27 governorates
const GOVERNORATES = [
    "Cairo", "Giza", "Alexandria", "Qalyubia", "Port Said", "Suez",
    "Dakahlia", "Sharqia", "Gharbia", "Monufia", "Beheira",
    "Kafr El Sheikh", "Damietta", "Ismailia", "Faiyum", "Beni Suef",
    "Minya", "Asyut", "Sohag", "Qena", "Luxor", "Aswan", "Red Sea",
    "New Valley", "Matrouh", "North Sinai", "South Sinai"
];

const PROPERTY_TYPES = [
    { value: "apartment", label: "شقة" },
    { value: "villa",     label: "فيلا" },
    { value: "duplex",    label: "دوبلكس" },
    { value: "penthouse", label: "بنتهاوس" },
    { value: "studio",    label: "استوديو" },
    { value: "townhouse", label: "تاون هاوس" },
    { value: "land",      label: "قطعة أرض" },
    { value: "shop",      label: "محل" },
    { value: "office",    label: "مكتب إداري" },
    { value: "clinic",    label: "عيادة" },
    { value: "showroom",  label: "معرض" }
];

function isValidPropertyType(value) {
    return PROPERTY_TYPES.some(t => t.value === value);
}

// Optional property fields: description, bedrooms, bathrooms, area
const DETAIL_FIELDS = ["description", "bedrooms", "bathrooms", "area"];

const MAX_MESSAGE_LENGTH = 2000;

module.exports = {
    GOVERNORATES,
    PROPERTY_TYPES,
    isValidPropertyType,
    DETAIL_FIELDS,
    MAX_MESSAGE_LENGTH
};
