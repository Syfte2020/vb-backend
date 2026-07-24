export function generateCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Generate 2 random letters
  const chars: string[] = [];
  for (let i = 0; i < 2; i++) {
    chars.push(letters[Math.floor(Math.random() * letters.length)]);
  }

  // Generate 4 random digits
  for (let i = 0; i < 4; i++) {
    chars.push(Math.floor(Math.random() * 10).toString());
  }

  // Shuffle (Fisher-Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export function total_code_generating() {
 const LETTERS = 26;
const LETTER_COUNT = 2;
const DIGIT_COUNT = 4;

// nCr(6,2) = 15
const POSITION_COMBINATIONS = 15;

const total =
  Math.pow(LETTERS, LETTER_COUNT) *
  Math.pow(10, DIGIT_COUNT) *
  POSITION_COMBINATIONS;
  return total;
}

