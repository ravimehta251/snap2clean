// Client-side mapping of Karnataka districts to initial recipient email
// Update emails as needed; normalization will match common variants.
export const karnatakaDistrictEmails = [
  'Bagalkote','Ballari','Belagavi','Bengaluru Rural','Bengaluru Urban','Bidar','Vijayapura','Chamarajanagar','Chikkaballapur','Chikkamagaluru','Chitradurga','Dakshina Kannada','Davanagere','Dharwad','Gadag','Hassan','Haveri','Kalaburagi','Kodagu','Kolar','Koppal','Mandya','Mysuru','Raichur','Ramanagara','Shivamogga','Tumakuru','Udupi','Uttara Kannada','Yadgir','Vijayanagara'
].map(d => ({ district: d, email: 'snap2clean@gmail.com' }))

export function normalizeDistrict(name = '') {
  return name
    .toString()
    .toLowerCase()
    .replace(/district/g, '')
    .replace(/bengalore/g, 'bengaluru')
    .replace(/\s+/g, ' ')
    .trim()
}

export function lookupDistrictEmail(district) {
  const q = normalizeDistrict(district)
  let match = karnatakaDistrictEmails.find(e => normalizeDistrict(e.district) === q)
  if (!match) {
    match = karnatakaDistrictEmails.find(e => {
      const norm = normalizeDistrict(e.district)
      return norm.includes(q) || q.includes(norm)
    })
  }
  return match?.email || ''
}


