// Utility functions for Kenya time handling

/**
 * Format date to Kenya time string
 */
const formatKenyaTime = (date) => {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  
  return d.toLocaleString('en-KE', { 
    timeZone: 'Africa/Nairobi',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Get current Kenya time
 */
const getKenyaTime = () => {
  return new Date().toLocaleString('en-KE', { 
    timeZone: 'Africa/Nairobi',
    hour12: false 
  });
};

/**
 * Convert any date to Kenya time Date object
 */
const toKenyaTime = (date) => {
  const d = new Date(date);
  const kenyaTimeStr = d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' });
  return new Date(kenyaTimeStr);
};

/**
 * Check if a date is in Kenya time future
 */
const isFutureKenyaTime = (date) => {
  const kenyaDate = toKenyaTime(date);
  const kenyaNow = toKenyaTime(new Date());
  return kenyaDate > kenyaNow;
};

/**
 * Get time difference in minutes (Kenya time)
 */
const getKenyaTimeDiffMinutes = (date1, date2) => {
  const kenyaDate1 = toKenyaTime(date1);
  const kenyaDate2 = toKenyaTime(date2);
  return (kenyaDate2 - kenyaDate1) / (1000 * 60);
};

module.exports = {
  formatKenyaTime,
  getKenyaTime,
  toKenyaTime,
  isFutureKenyaTime,
  getKenyaTimeDiffMinutes
};