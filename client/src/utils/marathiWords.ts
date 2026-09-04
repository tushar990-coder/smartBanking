export const getAmountInWordsMarathi = (amount: number): string => {
  if (amount === 0) return 'शून्य रुपये';

  const singleDigits = ['', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ'];
  const twoDigits = [
    'दहा', 'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस',
    'वीस', 'एकवीस', 'बावीस', 'तेवीस', 'चोवीस', 'पंचवीस', 'सव्वीस', 'सत्तावीस', 'अठ्ठावीस', 'एकोणतीस',
    'तीस', 'एकतीस', 'बत्तीस', 'तेहतीस', 'चौतीस', 'पस्तीस', 'छत्तीस', 'सदतीस', 'अडतीस', 'एकोणचाळीस',
    'चाळीस', 'एकेचाळीस', 'बेचाळीस', 'त्रेचाळीस', 'चव्वेचाळीस', 'पंचेचाळीस', 'शेहेचाळीस', 'सत्तेचाळीस', 'अठ्ठेचाळीस', 'एकोणपन्नास',
    'पन्नास', 'एकावन्न', 'बावन', 'त्रेपन्न', 'चौपन्न', 'पंचावन्न', 'छप्पन्न', 'सत्तावन्न', 'अठ्ठावन्न', 'एकोणसाठ',
    'साठ', 'एकसष्ट', 'बासष्ट', 'त्रेसष्ट', 'चौसष्ट', 'पासष्ट', 'सहासष्ट', 'सदुसष्ट', 'अडुसष्ट', 'एकोणसत्तर',
    'सत्तर', 'एकाहत्तर', 'बहात्तर', 'त्र्याहत्तर', 'चौऱ्याहत्तर', 'पंच्याहत्तर', 'शहात्तर', 'सत्याहत्तर', 'अठ्ठ्याहत्तर', 'एकोणांशी',
    'ऐंशी', 'एक्याऐंशी', 'ब्याऐंशी', 'त्र्याऐंशी', 'चौऱ्याऐंशी', 'पंच्याऐंशी', 'शहाऐंशी', 'सत्याऐंशी', 'अठ्ठ्याऐंशी', 'एकोणनव्वद',
    'नव्वद', 'एक्याण्णव', 'ब्याण्णव', 'त्र्याण्णव', 'चौऱ्याण्णव', 'पंचाण्णव', 'शहाण्णव', 'सत्याण्णव', 'अठ्ठ्याण्णव', 'नव्व्याण्णव'
  ];

  const getTwoDigits = (num: number) => {
    if (num < 10) return singleDigits[num];
    return twoDigits[num - 10];
  };

  let word = '';
  let tempAmount = Math.floor(amount);

  const crore = Math.floor(tempAmount / 10000000);
  tempAmount %= 10000000;
  
  const lakh = Math.floor(tempAmount / 100000);
  tempAmount %= 100000;
  
  const thousand = Math.floor(tempAmount / 1000);
  tempAmount %= 1000;
  
  const hundred = Math.floor(tempAmount / 100);
  tempAmount %= 100;
  
  const tens = tempAmount;

  if (crore > 0) word += getTwoDigits(crore) + ' कोटी ';
  if (lakh > 0) word += getTwoDigits(lakh) + ' लाख ';
  if (thousand > 0) word += getTwoDigits(thousand) + ' हजार ';
  if (hundred > 0) {
    if (hundred === 1) word += 'एकशे ';
    else word += getTwoDigits(hundred) + 'शे ';
  }
  if (tens > 0) {
    word += getTwoDigits(tens) + ' ';
  }

  return word.trim() + ' रुपये मात्र';
};
