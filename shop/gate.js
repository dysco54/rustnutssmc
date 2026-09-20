const CODE_WORD = 'RSMC2019';

export function checkCodeWord(input) {
  return String(input ?? '').trim().toUpperCase() === CODE_WORD;
}
