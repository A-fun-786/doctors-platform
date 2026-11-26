export interface CountryDialCode {
  iso: string;
  name: string;
  dialCode: string;
  minDigits: number;
  maxDigits: number;
  mobilePattern?: RegExp;
  placeholder: string;
}

export const DEFAULT_COUNTRY_ISO = "IN";

/**
 * Complete A-Z list of countries and territories with international dialing codes.
 * Strictly sorted alphabetically by `name`.
 * India (+91) is the default clinic country with strict 10-digit mobile validation.
 */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso: "AF", name: "Afghanistan", dialCode: "+93", minDigits: 9, maxDigits: 9, placeholder: "701234567" },
  { iso: "AL", name: "Albania", dialCode: "+355", minDigits: 9, maxDigits: 9, placeholder: "672123456" },
  { iso: "DZ", name: "Algeria", dialCode: "+213", minDigits: 9, maxDigits: 9, placeholder: "551234567" },
  { iso: "AD", name: "Andorra", dialCode: "+376", minDigits: 6, maxDigits: 9, placeholder: "312345" },
  { iso: "AO", name: "Angola", dialCode: "+244", minDigits: 9, maxDigits: 9, placeholder: "923123456" },
  { iso: "AG", name: "Antigua and Barbuda", dialCode: "+1268", minDigits: 7, maxDigits: 7, placeholder: "4641234" },
  { iso: "AR", name: "Argentina", dialCode: "+54", minDigits: 10, maxDigits: 11, placeholder: "91123456789" },
  { iso: "AM", name: "Armenia", dialCode: "+374", minDigits: 8, maxDigits: 8, placeholder: "77123456" },
  { iso: "AU", name: "Australia", dialCode: "+61", minDigits: 9, maxDigits: 9, placeholder: "412345678" },
  { iso: "AT", name: "Austria", dialCode: "+43", minDigits: 10, maxDigits: 13, placeholder: "6641234567" },
  { iso: "AZ", name: "Azerbaijan", dialCode: "+994", minDigits: 9, maxDigits: 9, placeholder: "401234567" },
  { iso: "BS", name: "Bahamas", dialCode: "+1242", minDigits: 7, maxDigits: 7, placeholder: "3591234" },
  { iso: "BH", name: "Bahrain", dialCode: "+973", minDigits: 8, maxDigits: 8, placeholder: "36123456" },
  { iso: "BD", name: "Bangladesh", dialCode: "+880", minDigits: 10, maxDigits: 10, placeholder: "1712345678" },
  { iso: "BB", name: "Barbados", dialCode: "+1246", minDigits: 7, maxDigits: 7, placeholder: "2501234" },
  { iso: "BY", name: "Belarus", dialCode: "+375", minDigits: 9, maxDigits: 9, placeholder: "294911911" },
  { iso: "BE", name: "Belgium", dialCode: "+32", minDigits: 9, maxDigits: 9, placeholder: "470123456" },
  { iso: "BZ", name: "Belize", dialCode: "+501", minDigits: 7, maxDigits: 7, placeholder: "6221234" },
  { iso: "BJ", name: "Benin", dialCode: "+229", minDigits: 8, maxDigits: 8, placeholder: "90011234" },
  { iso: "BT", name: "Bhutan", dialCode: "+975", minDigits: 8, maxDigits: 8, placeholder: "17123456" },
  { iso: "BO", name: "Bolivia", dialCode: "+591", minDigits: 8, maxDigits: 8, placeholder: "71234567" },
  { iso: "BA", name: "Bosnia and Herzegovina", dialCode: "+387", minDigits: 8, maxDigits: 9, placeholder: "61123456" },
  { iso: "BW", name: "Botswana", dialCode: "+267", minDigits: 8, maxDigits: 8, placeholder: "71123456" },
  { iso: "BR", name: "Brazil", dialCode: "+55", minDigits: 10, maxDigits: 11, placeholder: "11912345678" },
  { iso: "BN", name: "Brunei", dialCode: "+673", minDigits: 7, maxDigits: 7, placeholder: "7123456" },
  { iso: "BG", name: "Bulgaria", dialCode: "+359", minDigits: 8, maxDigits: 9, placeholder: "48123456" },
  { iso: "BF", name: "Burkina Faso", dialCode: "+226", minDigits: 8, maxDigits: 8, placeholder: "70123456" },
  { iso: "BI", name: "Burundi", dialCode: "+257", minDigits: 8, maxDigits: 8, placeholder: "79561234" },
  { iso: "CV", name: "Cabo Verde", dialCode: "+238", minDigits: 7, maxDigits: 7, placeholder: "9911234" },
  { iso: "KH", name: "Cambodia", dialCode: "+855", minDigits: 8, maxDigits: 9, placeholder: "91234567" },
  { iso: "CM", name: "Cameroon", dialCode: "+237", minDigits: 9, maxDigits: 9, placeholder: "671234567" },
  { iso: "CA", name: "Canada", dialCode: "+1", minDigits: 10, maxDigits: 10, placeholder: "4165551234" },
  { iso: "CF", name: "Central African Republic", dialCode: "+236", minDigits: 8, maxDigits: 8, placeholder: "70012345" },
  { iso: "TD", name: "Chad", dialCode: "+235", minDigits: 8, maxDigits: 8, placeholder: "63012345" },
  { iso: "CL", name: "Chile", dialCode: "+56", minDigits: 9, maxDigits: 9, placeholder: "912345678" },
  { iso: "CN", name: "China", dialCode: "+86", minDigits: 11, maxDigits: 11, placeholder: "13812345678" },
  { iso: "CO", name: "Colombia", dialCode: "+57", minDigits: 10, maxDigits: 10, placeholder: "3211234567" },
  { iso: "KM", name: "Comoros", dialCode: "+269", minDigits: 7, maxDigits: 7, placeholder: "3212345" },
  { iso: "CG", name: "Congo", dialCode: "+242", minDigits: 9, maxDigits: 9, placeholder: "061234567" },
  { iso: "CD", name: "Congo (DRC)", dialCode: "+243", minDigits: 9, maxDigits: 9, placeholder: "991234567" },
  { iso: "CR", name: "Costa Rica", dialCode: "+506", minDigits: 8, maxDigits: 8, placeholder: "83123456" },
  { iso: "CI", name: "Cote d'Ivoire", dialCode: "+225", minDigits: 10, maxDigits: 10, placeholder: "0123456789" },
  { iso: "HR", name: "Croatia", dialCode: "+385", minDigits: 8, maxDigits: 9, placeholder: "921234567" },
  { iso: "CU", name: "Cuba", dialCode: "+53", minDigits: 8, maxDigits: 8, placeholder: "51234567" },
  { iso: "CY", name: "Cyprus", dialCode: "+357", minDigits: 8, maxDigits: 8, placeholder: "96123456" },
  { iso: "CZ", name: "Czechia", dialCode: "+420", minDigits: 9, maxDigits: 9, placeholder: "601123456" },
  { iso: "DK", name: "Denmark", dialCode: "+45", minDigits: 8, maxDigits: 8, placeholder: "32123456" },
  { iso: "DJ", name: "Djibouti", dialCode: "+253", minDigits: 8, maxDigits: 8, placeholder: "77831001" },
  { iso: "DM", name: "Dominica", dialCode: "+1767", minDigits: 7, maxDigits: 7, placeholder: "2251234" },
  { iso: "DO", name: "Dominican Republic", dialCode: "+1809", minDigits: 7, maxDigits: 7, placeholder: "2345678" },
  { iso: "EC", name: "Ecuador", dialCode: "+593", minDigits: 9, maxDigits: 9, placeholder: "991234567" },
  { iso: "EG", name: "Egypt", dialCode: "+20", minDigits: 10, maxDigits: 10, placeholder: "1001234567" },
  { iso: "SV", name: "El Salvador", dialCode: "+503", minDigits: 8, maxDigits: 8, placeholder: "70123456" },
  { iso: "GQ", name: "Equatorial Guinea", dialCode: "+240", minDigits: 9, maxDigits: 9, placeholder: "222123456" },
  { iso: "ER", name: "Eritrea", dialCode: "+291", minDigits: 7, maxDigits: 7, placeholder: "7123456" },
  { iso: "EE", name: "Estonia", dialCode: "+372", minDigits: 7, maxDigits: 8, placeholder: "51234567" },
  { iso: "SZ", name: "Eswatini", dialCode: "+268", minDigits: 8, maxDigits: 8, placeholder: "76123456" },
  { iso: "ET", name: "Ethiopia", dialCode: "+251", minDigits: 9, maxDigits: 9, placeholder: "911234567" },
  { iso: "FJ", name: "Fiji", dialCode: "+679", minDigits: 7, maxDigits: 7, placeholder: "7012345" },
  { iso: "FI", name: "Finland", dialCode: "+358", minDigits: 9, maxDigits: 10, placeholder: "412345678" },
  { iso: "FR", name: "France", dialCode: "+33", minDigits: 9, maxDigits: 9, placeholder: "612345678" },
  { iso: "GA", name: "Gabon", dialCode: "+241", minDigits: 7, maxDigits: 8, placeholder: "06031234" },
  { iso: "GM", name: "Gambia", dialCode: "+220", minDigits: 7, maxDigits: 7, placeholder: "3012345" },
  { iso: "GE", name: "Georgia", dialCode: "+995", minDigits: 9, maxDigits: 9, placeholder: "555123456" },
  { iso: "DE", name: "Germany", dialCode: "+49", minDigits: 10, maxDigits: 11, placeholder: "15112345678" },
  { iso: "GH", name: "Ghana", dialCode: "+233", minDigits: 9, maxDigits: 9, placeholder: "231234567" },
  { iso: "GR", name: "Greece", dialCode: "+30", minDigits: 10, maxDigits: 10, placeholder: "6912345678" },
  { iso: "GD", name: "Grenada", dialCode: "+1473", minDigits: 7, maxDigits: 7, placeholder: "4031234" },
  { iso: "GT", name: "Guatemala", dialCode: "+502", minDigits: 8, maxDigits: 8, placeholder: "51234567" },
  { iso: "GN", name: "Guinea", dialCode: "+224", minDigits: 9, maxDigits: 9, placeholder: "601123456" },
  { iso: "GW", name: "Guinea-Bissau", dialCode: "+245", minDigits: 7, maxDigits: 9, placeholder: "955012345" },
  { iso: "GY", name: "Guyana", dialCode: "+592", minDigits: 7, maxDigits: 7, placeholder: "6091234" },
  { iso: "HT", name: "Haiti", dialCode: "+509", minDigits: 8, maxDigits: 8, placeholder: "34101234" },
  { iso: "HN", name: "Honduras", dialCode: "+504", minDigits: 8, maxDigits: 8, placeholder: "91234567" },
  { iso: "HK", name: "Hong Kong", dialCode: "+852", minDigits: 8, maxDigits: 8, placeholder: "51234567" },
  { iso: "HU", name: "Hungary", dialCode: "+36", minDigits: 9, maxDigits: 9, placeholder: "201234567" },
  { iso: "IS", name: "Iceland", dialCode: "+354", minDigits: 7, maxDigits: 7, placeholder: "6111234" },
  {
    iso: "IN",
    name: "India",
    dialCode: "+91",
    minDigits: 10,
    maxDigits: 10,
    mobilePattern: /^[6-9]\d{9}$/,
    placeholder: "9876543210",
  },
  { iso: "ID", name: "Indonesia", dialCode: "+62", minDigits: 9, maxDigits: 12, placeholder: "81234567890" },
  { iso: "IR", name: "Iran", dialCode: "+98", minDigits: 10, maxDigits: 10, placeholder: "9123456789" },
  { iso: "IQ", name: "Iraq", dialCode: "+964", minDigits: 10, maxDigits: 10, placeholder: "7912345678" },
  { iso: "IE", name: "Ireland", dialCode: "+353", minDigits: 9, maxDigits: 9, placeholder: "851234567" },
  { iso: "IL", name: "Israel", dialCode: "+972", minDigits: 9, maxDigits: 9, placeholder: "501234567" },
  { iso: "IT", name: "Italy", dialCode: "+39", minDigits: 9, maxDigits: 10, placeholder: "3123456789" },
  { iso: "JM", name: "Jamaica", dialCode: "+1876", minDigits: 7, maxDigits: 7, placeholder: "2101234" },
  { iso: "JP", name: "Japan", dialCode: "+81", minDigits: 10, maxDigits: 10, placeholder: "9012345678" },
  { iso: "JO", name: "Jordan", dialCode: "+962", minDigits: 9, maxDigits: 9, placeholder: "790123456" },
  { iso: "KZ", name: "Kazakhstan", dialCode: "+7", minDigits: 10, maxDigits: 10, placeholder: "7710009998" },
  { iso: "KE", name: "Kenya", dialCode: "+254", minDigits: 9, maxDigits: 9, placeholder: "712345678" },
  { iso: "KI", name: "Kiribati", dialCode: "+686", minDigits: 5, maxDigits: 8, placeholder: "72001234" },
  { iso: "KW", name: "Kuwait", dialCode: "+965", minDigits: 8, maxDigits: 8, placeholder: "50123456" },
  { iso: "KG", name: "Kyrgyzstan", dialCode: "+996", minDigits: 9, maxDigits: 9, placeholder: "700123456" },
  { iso: "LA", name: "Laos", dialCode: "+856", minDigits: 9, maxDigits: 10, placeholder: "2023123456" },
  { iso: "LV", name: "Latvia", dialCode: "+371", minDigits: 8, maxDigits: 8, placeholder: "21234567" },
  { iso: "LB", name: "Lebanon", dialCode: "+961", minDigits: 7, maxDigits: 8, placeholder: "71123456" },
  { iso: "LS", name: "Lesotho", dialCode: "+266", minDigits: 8, maxDigits: 8, placeholder: "50123456" },
  { iso: "LR", name: "Liberia", dialCode: "+231", minDigits: 7, maxDigits: 9, placeholder: "770123456" },
  { iso: "LY", name: "Libya", dialCode: "+218", minDigits: 9, maxDigits: 9, placeholder: "912345678" },
  { iso: "LI", name: "Liechtenstein", dialCode: "+423", minDigits: 7, maxDigits: 9, placeholder: "660234567" },
  { iso: "LT", name: "Lithuania", dialCode: "+370", minDigits: 8, maxDigits: 8, placeholder: "61234567" },
  { iso: "LU", name: "Luxembourg", dialCode: "+352", minDigits: 9, maxDigits: 9, placeholder: "628123456" },
  { iso: "MO", name: "Macau", dialCode: "+853", minDigits: 8, maxDigits: 8, placeholder: "66123456" },
  { iso: "MG", name: "Madagascar", dialCode: "+261", minDigits: 9, maxDigits: 9, placeholder: "321234567" },
  { iso: "MW", name: "Malawi", dialCode: "+265", minDigits: 9, maxDigits: 9, placeholder: "991234567" },
  { iso: "MY", name: "Malaysia", dialCode: "+60", minDigits: 9, maxDigits: 10, placeholder: "123456789" },
  { iso: "MV", name: "Maldives", dialCode: "+960", minDigits: 7, maxDigits: 7, placeholder: "7712345" },
  { iso: "ML", name: "Mali", dialCode: "+223", minDigits: 8, maxDigits: 8, placeholder: "65012345" },
  { iso: "MT", name: "Malta", dialCode: "+356", minDigits: 8, maxDigits: 8, placeholder: "96961234" },
  { iso: "MH", name: "Marshall Islands", dialCode: "+692", minDigits: 7, maxDigits: 7, placeholder: "2351234" },
  { iso: "MR", name: "Mauritania", dialCode: "+222", minDigits: 8, maxDigits: 8, placeholder: "22123456" },
  { iso: "MU", name: "Mauritius", dialCode: "+230", minDigits: 8, maxDigits: 8, placeholder: "52512345" },
  { iso: "MX", name: "Mexico", dialCode: "+52", minDigits: 10, maxDigits: 10, placeholder: "5512345678" },
  { iso: "FM", name: "Micronesia", dialCode: "+691", minDigits: 7, maxDigits: 7, placeholder: "3501234" },
  { iso: "MD", name: "Moldova", dialCode: "+373", minDigits: 8, maxDigits: 8, placeholder: "62112345" },
  { iso: "MC", name: "Monaco", dialCode: "+377", minDigits: 8, maxDigits: 9, placeholder: "612345678" },
  { iso: "MN", name: "Mongolia", dialCode: "+976", minDigits: 8, maxDigits: 8, placeholder: "88123456" },
  { iso: "ME", name: "Montenegro", dialCode: "+382", minDigits: 8, maxDigits: 8, placeholder: "67622901" },
  { iso: "MA", name: "Morocco", dialCode: "+212", minDigits: 9, maxDigits: 9, placeholder: "650123456" },
  { iso: "MZ", name: "Mozambique", dialCode: "+258", minDigits: 9, maxDigits: 9, placeholder: "821234567" },
  { iso: "MM", name: "Myanmar", dialCode: "+95", minDigits: 8, maxDigits: 10, placeholder: "921234567" },
  { iso: "NA", name: "Namibia", dialCode: "+264", minDigits: 9, maxDigits: 9, placeholder: "811234567" },
  { iso: "NR", name: "Nauru", dialCode: "+674", minDigits: 7, maxDigits: 7, placeholder: "5551234" },
  { iso: "NP", name: "Nepal", dialCode: "+977", minDigits: 10, maxDigits: 10, placeholder: "9841234567" },
  { iso: "NL", name: "Netherlands", dialCode: "+31", minDigits: 9, maxDigits: 9, placeholder: "612345678" },
  { iso: "NZ", name: "New Zealand", dialCode: "+64", minDigits: 8, maxDigits: 10, placeholder: "211234567" },
  { iso: "NI", name: "Nicaragua", dialCode: "+505", minDigits: 8, maxDigits: 8, placeholder: "81234567" },
  { iso: "NE", name: "Niger", dialCode: "+227", minDigits: 8, maxDigits: 8, placeholder: "93123456" },
  { iso: "NG", name: "Nigeria", dialCode: "+234", minDigits: 10, maxDigits: 10, placeholder: "8021234567" },
  { iso: "KP", name: "North Korea", dialCode: "+850", minDigits: 9, maxDigits: 10, placeholder: "1921234567" },
  { iso: "MK", name: "North Macedonia", dialCode: "+389", minDigits: 8, maxDigits: 8, placeholder: "72345678" },
  { iso: "NO", name: "Norway", dialCode: "+47", minDigits: 8, maxDigits: 8, placeholder: "40612345" },
  { iso: "OM", name: "Oman", dialCode: "+968", minDigits: 8, maxDigits: 8, placeholder: "92123456" },
  { iso: "PK", name: "Pakistan", dialCode: "+92", minDigits: 10, maxDigits: 10, placeholder: "3001234567" },
  { iso: "PW", name: "Palau", dialCode: "+680", minDigits: 7, maxDigits: 7, placeholder: "6201234" },
  { iso: "PS", name: "Palestine", dialCode: "+970", minDigits: 9, maxDigits: 9, placeholder: "599123456" },
  { iso: "PA", name: "Panama", dialCode: "+507", minDigits: 8, maxDigits: 8, placeholder: "61234567" },
  { iso: "PG", name: "Papua New Guinea", dialCode: "+675", minDigits: 8, maxDigits: 8, placeholder: "70123456" },
  { iso: "PY", name: "Paraguay", dialCode: "+595", minDigits: 9, maxDigits: 9, placeholder: "961456789" },
  { iso: "PE", name: "Peru", dialCode: "+51", minDigits: 9, maxDigits: 9, placeholder: "912345678" },
  { iso: "PH", name: "Philippines", dialCode: "+63", minDigits: 10, maxDigits: 10, placeholder: "9171234567" },
  { iso: "PL", name: "Poland", dialCode: "+48", minDigits: 9, maxDigits: 9, placeholder: "512345678" },
  { iso: "PT", name: "Portugal", dialCode: "+351", minDigits: 9, maxDigits: 9, placeholder: "912345678" },
  { iso: "QA", name: "Qatar", dialCode: "+974", minDigits: 8, maxDigits: 8, placeholder: "55123456" },
  { iso: "RO", name: "Romania", dialCode: "+40", minDigits: 9, maxDigits: 9, placeholder: "712034567" },
  { iso: "RU", name: "Russia", dialCode: "+7", minDigits: 10, maxDigits: 10, placeholder: "9123456789" },
  { iso: "RW", name: "Rwanda", dialCode: "+250", minDigits: 9, maxDigits: 9, placeholder: "720123456" },
  { iso: "KN", name: "Saint Kitts and Nevis", dialCode: "+1869", minDigits: 7, maxDigits: 7, placeholder: "7652917" },
  { iso: "LC", name: "Saint Lucia", dialCode: "+1758", minDigits: 7, maxDigits: 7, placeholder: "2845678" },
  { iso: "VC", name: "Saint Vincent and the Grenadines", dialCode: "+1784", minDigits: 7, maxDigits: 7, placeholder: "4301234" },
  { iso: "WS", name: "Samoa", dialCode: "+685", minDigits: 7, maxDigits: 7, placeholder: "7212345" },
  { iso: "SM", name: "San Marino", dialCode: "+378", minDigits: 8, maxDigits: 10, placeholder: "66661212" },
  { iso: "ST", name: "Sao Tome and Principe", dialCode: "+239", minDigits: 7, maxDigits: 7, placeholder: "9812345" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "+966", minDigits: 9, maxDigits: 9, placeholder: "501234567" },
  { iso: "SN", name: "Senegal", dialCode: "+221", minDigits: 9, maxDigits: 9, placeholder: "701234567" },
  { iso: "RS", name: "Serbia", dialCode: "+381", minDigits: 8, maxDigits: 9, placeholder: "601234567" },
  { iso: "SC", name: "Seychelles", dialCode: "+248", minDigits: 7, maxDigits: 7, placeholder: "2510123" },
  { iso: "SL", name: "Sierra Leone", dialCode: "+232", minDigits: 8, maxDigits: 8, placeholder: "25123456" },
  { iso: "SG", name: "Singapore", dialCode: "+65", minDigits: 8, maxDigits: 8, placeholder: "81234567" },
  { iso: "SK", name: "Slovakia", dialCode: "+421", minDigits: 9, maxDigits: 9, placeholder: "912123456" },
  { iso: "SI", name: "Slovenia", dialCode: "+386", minDigits: 8, maxDigits: 8, placeholder: "31234567" },
  { iso: "SB", name: "Solomon Islands", dialCode: "+677", minDigits: 7, maxDigits: 7, placeholder: "7421234" },
  { iso: "SO", name: "Somalia", dialCode: "+252", minDigits: 8, maxDigits: 9, placeholder: "71123456" },
  { iso: "ZA", name: "South Africa", dialCode: "+27", minDigits: 9, maxDigits: 9, placeholder: "711234567" },
  { iso: "KR", name: "South Korea", dialCode: "+82", minDigits: 9, maxDigits: 10, placeholder: "1012345678" },
  { iso: "SS", name: "South Sudan", dialCode: "+211", minDigits: 9, maxDigits: 9, placeholder: "977123456" },
  { iso: "ES", name: "Spain", dialCode: "+34", minDigits: 9, maxDigits: 9, placeholder: "612345678" },
  { iso: "LK", name: "Sri Lanka", dialCode: "+94", minDigits: 9, maxDigits: 9, placeholder: "712345678" },
  { iso: "SD", name: "Sudan", dialCode: "+249", minDigits: 9, maxDigits: 9, placeholder: "911231234" },
  { iso: "SR", name: "Suriname", dialCode: "+597", minDigits: 7, maxDigits: 7, placeholder: "7412345" },
  { iso: "SE", name: "Sweden", dialCode: "+46", minDigits: 9, maxDigits: 9, placeholder: "701234567" },
  { iso: "CH", name: "Switzerland", dialCode: "+41", minDigits: 9, maxDigits: 9, placeholder: "791234567" },
  { iso: "SY", name: "Syria", dialCode: "+963", minDigits: 9, maxDigits: 9, placeholder: "944567890" },
  { iso: "TW", name: "Taiwan", dialCode: "+886", minDigits: 9, maxDigits: 9, placeholder: "912345678" },
  { iso: "TJ", name: "Tajikistan", dialCode: "+992", minDigits: 9, maxDigits: 9, placeholder: "917123456" },
  { iso: "TZ", name: "Tanzania", dialCode: "+255", minDigits: 9, maxDigits: 9, placeholder: "621234567" },
  { iso: "TH", name: "Thailand", dialCode: "+66", minDigits: 9, maxDigits: 9, placeholder: "812345678" },
  { iso: "TL", name: "Timor-Leste", dialCode: "+670", minDigits: 8, maxDigits: 8, placeholder: "77212345" },
  { iso: "TG", name: "Togo", dialCode: "+228", minDigits: 8, maxDigits: 8, placeholder: "90112345" },
  { iso: "TO", name: "Tonga", dialCode: "+676", minDigits: 7, maxDigits: 7, placeholder: "7715123" },
  { iso: "TT", name: "Trinidad and Tobago", dialCode: "+1868", minDigits: 7, maxDigits: 7, placeholder: "2911234" },
  { iso: "TN", name: "Tunisia", dialCode: "+216", minDigits: 8, maxDigits: 8, placeholder: "20123456" },
  { iso: "TR", name: "Turkey", dialCode: "+90", minDigits: 10, maxDigits: 10, placeholder: "5012345678" },
  { iso: "TM", name: "Turkmenistan", dialCode: "+993", minDigits: 8, maxDigits: 8, placeholder: "66123456" },
  { iso: "TV", name: "Tuvalu", dialCode: "+688", minDigits: 5, maxDigits: 7, placeholder: "901234" },
  { iso: "UG", name: "Uganda", dialCode: "+256", minDigits: 9, maxDigits: 9, placeholder: "712345678" },
  { iso: "UA", name: "Ukraine", dialCode: "+380", minDigits: 9, maxDigits: 9, placeholder: "501234567" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971", minDigits: 9, maxDigits: 9, placeholder: "501234567" },
  { iso: "GB", name: "United Kingdom", dialCode: "+44", minDigits: 10, maxDigits: 10, placeholder: "7911123456" },
  { iso: "US", name: "United States", dialCode: "+1", minDigits: 10, maxDigits: 10, placeholder: "4155551234" },
  { iso: "UY", name: "Uruguay", dialCode: "+598", minDigits: 8, maxDigits: 8, placeholder: "94231234" },
  { iso: "UZ", name: "Uzbekistan", dialCode: "+998", minDigits: 9, maxDigits: 9, placeholder: "912345678" },
  { iso: "VU", name: "Vanuatu", dialCode: "+678", minDigits: 7, maxDigits: 7, placeholder: "5912345" },
  { iso: "VA", name: "Vatican City", dialCode: "+379", minDigits: 6, maxDigits: 10, placeholder: "0669881234" },
  { iso: "VE", name: "Venezuela", dialCode: "+58", minDigits: 10, maxDigits: 10, placeholder: "4121234567" },
  { iso: "VN", name: "Vietnam", dialCode: "+84", minDigits: 9, maxDigits: 10, placeholder: "912345678" },
  { iso: "YE", name: "Yemen", dialCode: "+967", minDigits: 9, maxDigits: 9, placeholder: "712345678" },
  { iso: "ZM", name: "Zambia", dialCode: "+260", minDigits: 9, maxDigits: 9, placeholder: "955123456" },
  { iso: "ZW", name: "Zimbabwe", dialCode: "+263", minDigits: 9, maxDigits: 9, placeholder: "712345678" },
];

// Longest dial code first for unambiguous prefix matching (e.g. +1876 before +1, +971 before +9).
// Prefer US over CA for +1 and RU over KZ for +7 when no preferred country is set.
const DIAL_CODE_PRIORITY: Record<string, number> = { US: 2, RU: 2, IN: 2, GB: 2 };
const COUNTRIES_BY_DIAL_LENGTH = [...COUNTRY_DIAL_CODES].sort((a, b) => {
  if (b.dialCode.length !== a.dialCode.length) {
    return b.dialCode.length - a.dialCode.length;
  }
  return (DIAL_CODE_PRIORITY[b.iso] || 0) - (DIAL_CODE_PRIORITY[a.iso] || 0);
});

export function getDefaultCountry(): CountryDialCode {
  return COUNTRY_DIAL_CODES.find((c) => c.iso === DEFAULT_COUNTRY_ISO) || COUNTRY_DIAL_CODES[0];
}

export function getCountryByIso(iso: string): CountryDialCode {
  return COUNTRY_DIAL_CODES.find((c) => c.iso === iso) || getDefaultCountry();
}

export function parsePhoneWithCountry(
  rawPhone: string | null | undefined,
  fallbackIso: string = DEFAULT_COUNTRY_ISO
): { country: CountryDialCode; localDigits: string } {
  const trimmed = (rawPhone || "").trim();
  if (!trimmed) {
    return { country: getCountryByIso(fallbackIso), localDigits: "" };
  }

  const compact = trimmed.replace(/[\s\-().]/g, "");
  if (compact.startsWith("+")) {
    const preferred = getCountryByIso(fallbackIso);
    if (compact.startsWith(preferred.dialCode)) {
      const hasLongerMatch = COUNTRIES_BY_DIAL_LENGTH.some(
        (c) => c.dialCode.length > preferred.dialCode.length && compact.startsWith(c.dialCode)
      );
      if (!hasLongerMatch) {
        return {
          country: preferred,
          localDigits: compact.slice(preferred.dialCode.length).replace(/\D/g, ""),
        };
      }
    }

    const matched = COUNTRIES_BY_DIAL_LENGTH.find((c) => compact.startsWith(c.dialCode));
    if (matched) {
      const rest = compact.slice(matched.dialCode.length).replace(/\D/g, "");
      return { country: matched, localDigits: rest };
    }
  }

  return {
    country: getCountryByIso(fallbackIso),
    localDigits: compact.replace(/\D/g, ""),
  };
}

export function formatPhoneWithCountry(country: CountryDialCode, localDigits: string): string {
  const digits = localDigits.replace(/\D/g, "");
  if (!digits) return "";
  return `${country.dialCode} ${digits}`;
}

export function getLocalPhoneWarning(
  localDigits: string,
  country: CountryDialCode,
  isTouched: boolean = false
): string | null {
  const digits = localDigits.replace(/\D/g, "");
  if (!digits) {
    return isTouched ? "Mobile number is required." : null;
  }

  if (country.minDigits === country.maxDigits) {
    if (digits.length !== country.minDigits) {
      return `Enter a valid ${country.minDigits}-digit mobile number for ${country.name} (currently ${digits.length}).`;
    }
  } else if (digits.length < country.minDigits || digits.length > country.maxDigits) {
    return `Enter ${country.minDigits}–${country.maxDigits} digits for ${country.name} (currently ${digits.length}).`;
  }

  if (country.mobilePattern && !country.mobilePattern.test(digits)) {
    if (country.iso === "IN") {
      return "Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9.";
    }
    return `Invalid mobile number format for ${country.name}.`;
  }

  if (new Set(digits).size === 1) {
    return "Enter a valid mobile number (cannot be all identical digits).";
  }

  return null;
}

export function validateStaffPhoneValue(
  rawPhone: string | null | undefined,
  isTouched: boolean = true
): string | null {
  const { country, localDigits } = parsePhoneWithCountry(rawPhone);
  return getLocalPhoneWarning(localDigits, country, isTouched);
}
