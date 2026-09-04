// Comprehensive Marathi (Devanagari) to English (Phonetic ASCII) Transliteration Engine

// Custom Dictionary for standard Marathi surnames & common names
const DICTIONARY: Record<string, string> = {
  // Common Surnames
  'पाटील': 'Patil',
  'शिंदे': 'Shinde',
  'पवार': 'Pawar',
  'जाधव': 'Jadhav',
  'गायकवाड': 'Gaikwad',
  'कदम': 'Kadam',
  'देशमुख': 'Deshmukh',
  'जोशी': 'Joshi',
  'कुलकर्णी': 'Kulkarni',
  'चव्हाण': 'Chavan',
  'मोहिते': 'Mohite',
  'साळुंखे': 'Salunkhe',
  'राऊत': 'Raut',
  'माने': 'Mane',
  'भोसले': 'Bhosale',
  'निकम': 'Nikam',
  'सूर्यवंशी': 'Suryawanshi',
  'जगताप': 'Jagtap',
  'कांबळे': 'Kamble',
  'मोरया': 'Morya',
  'शिरके': 'Shirke',
  'जाधवराव': 'Jadhavrao',
  'घाडगे': 'Ghadge',
  'धावडे': 'Dhawade',
  'नेहरे': 'Nehre',
  'शेळके': 'Shelke',
  'खरात': 'Kharat',
  'वाघमारे': 'Waghmare',
  'गौडा': 'Gowda',
  'सावंत': 'Sawant',
  'ठोकळे': 'Thokale',

  // Common First Names
  'राम': 'Ram',
  'लक्ष्मण': 'Laxman',
  'भरत': 'Bharat',
  'शत्रुघ्न': 'Shatrughna',
  'दत्तात्रय': 'Dattatray',
  'ज्ञानेश्वर': 'Dnyaneshwar',
  'तुकडोजी': 'Tukdoji',
  'विठ्ठल': 'Vitthal',
  'तुकाराम': 'Tukaram',
  'एकनाथ': 'Eknath',
  'नामदेव': 'Namdev',
  'मारुती': 'Maruti',
  'हनुमंत': 'Hanumant',
  'गणेश': 'Ganesh',
  'सुरेश': 'Suresh',
  'रमेश': 'Ramesh',
  'महेश': 'Mahesh',
  'दिनेश': 'Dinesh',
  'राजेश': 'Rajesh',
  'उमेश': 'Umesh',
  'योगेश': 'Yogesh',
  'संतोष': 'Santosh',
  'तुषार': 'Tushar',
  'सचिन': 'Sachin',
  'राहुल': 'Rahul',
  'अमित': 'Amit',
  'विजय': 'Vijay',
  'अजय': 'Ajay',
  'संजय': 'Sanjay',
  'धनंजय': 'Dhananjay',
  'अमोल': 'Amol',
  'अतुल': 'Atul',
  'प्रशांत': 'Prashant',
  'प्रविण': 'Pravin',
  'प्रवीण': 'Pravin',
  'किरण': 'Kiran',
  'विकास': 'Vikas',
  'विशाल': 'Vishal',
  'स्वप्निल': 'Swapnil',
  'निलेश': 'Nilesh',
  'राकेश': 'Rakesh',
  'मंगेश': 'Mangesh',
  'अंकुश': 'Ankush',
  'सुभाष': 'Subhash',
  'प्रकाश': 'Prakash',
  'चंद्रकांत': 'Chandrakant',
  'सूर्यकांत': 'Suryakant',
  'शशिकांत': 'Shashikant',
  'शंतनू': 'Shantanu',
  'अनंत': 'Anant',
  'वसंत': 'Vasant',
  'जयंत': 'Jayant',
  'श्रीकांत': 'Shrikant',
  'दीपक': 'Deepak',
  'संदीप': 'Sandeep',
  'प्रदीप': 'Pradeep',
  'सुधीर': 'Sudhir',
  'सुनील': 'Sunil',
  'अनिल': 'Anil',
  'सुनीता': 'Sunita',
  'अनिता': 'Anita',
  'कविता': 'Kavita',
  'संगीता': 'Sangeeta',
  'स्वाती': 'Swati',
  'श्वेता': 'Shweta',
  'पूजा': 'Pooja',
  'प्रियंका': 'Priyanka',
  'नेहा': 'Neha',
  'स्नेहा': 'Sneha',
  'वैशाली': 'Vaishali',
  'रुपाली': 'Rupali',
  'सोनाली': 'Sonali',
  'मनीषा': 'Manisha'
};

const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ru', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'am', 'अः': 'ah'
};

const MATRAS: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
  'ृ': 'ru', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ः': 'h'
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l', 'क्ष': 'ksh', 'ज्ञ': 'dnya'
};

export function transliterateMarathiWord(word: string): string {
  if (!word) return '';

  const trimmed = word.trim();
  // Check exact dictionary match
  if (DICTIONARY[trimmed]) {
    return DICTIONARY[trimmed];
  }

  let result = '';
  const len = trimmed.length;

  for (let i = 0; i < len; i++) {
    const char = trimmed[i];
    const nextChar = i + 1 < len ? trimmed[i + 1] : '';

    if (VOWELS[char]) {
      result += VOWELS[char];
    } else if (CONSONANTS[char]) {
      const base = CONSONANTS[char];

      if (nextChar === '्') {
        // Halant - half consonant, no trailing vowel
        result += base;
        i++; // skip halant
      } else if (MATRAS[nextChar]) {
        // Consonant followed by a Matra
        result += base + MATRAS[nextChar];
        i++; // skip matra
      } else {
        // Independent consonant with inherent 'a' sound
        // If it's the last character of the word, omit the trailing 'a' (schwa deletion in Marathi)
        const isLastChar = (i === len - 1);
        if (isLastChar && base.length > 0) {
          result += base;
        } else {
          result += base + 'a';
        }
      }
    } else if (MATRAS[char]) {
      result += MATRAS[char];
    } else {
      // Non-Devanagari or space
      result += char;
    }
  }

  // Capitalize First Letter of each word
  if (result.length > 0) {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

export function transliterateMarathi(text: string): string {
  if (!text) return '';
  return text.split(/\s+/).map(transliterateMarathiWord).join(' ');
}
