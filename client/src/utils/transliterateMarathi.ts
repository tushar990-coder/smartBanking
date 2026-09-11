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
  'निकam': 'Nikam',
  'निकम': 'Nikam',
  'सूर्यवंशी': 'Suryawanshi',
  'जगताप': 'Jagtap',
  'कांबळे': 'Kamble',
  'मोरया': 'Morya',
  'शिरके': 'Shirke',
  'शिर्के': 'Shirke',
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
  'मोरे': 'More',
  'काळे': 'Kale',
  'थोरात': 'Thorat',
  'सोनवणे': 'Sonawane',
  'सोनवणेे': 'Sonawane',
  'सोनवणेकर': 'Sonawanekar',
  'तांबे': 'Tambe',
  'शेटे': 'Shete',
  'कोल्हे': 'Kolhe',
  'गाडगीळ': 'Gadgil',
  'पंडित': 'Pandit',
  'दाभोळकर': 'Dabholkar',
  'चौगुले': 'Chougule',
  'लोखंडे': 'Lokhande',
  'गोरे': 'Gore',
  'धुमाळ': 'Dhumal',
  'खेडकर': 'Khedkar',
  'घोडे': 'Ghode',
  'बोरकर': 'Borkar',
  'साने': 'Sane',
  'दांडेकर': 'Dandekar',
  'भगत': 'Bhagat',
  'गवळी': 'Gawali',
  'वाघ': 'Wagh',
  'पांढरे': 'Pandhare',
  'सपकाळ': 'Sapkal',
  'सरोदे': 'Sarode',
  'इंगळे': 'Ingle',
  'वाघचौरे': 'Waghchaure',
  'खताळ': 'Khatal',
  'गाढवे': 'Gadhawe',
  'मोटे': 'Mote',
  'बोडके': 'Bodke',
  'गरजे': 'Garje',
  'घुले': 'Ghule',
  'भालेराव': 'Bhalerao',
  'भोयर': 'Bhoyar',
  'झेंडे': 'Zende',
  'फडतरे': 'Phadtare',
  'फाळके': 'Phalke',
  'म्हस्के': 'Mhaske',
  'लांडगे': 'Landge',
  'हांडे': 'Hande',
  'काकडे': 'Kakade',
  'दरेकर': 'Darekar',
  'गावडे': 'Gawade',
  'शिरोळे': 'Shirole',
  'तपकीर': 'Tapkir',
  'बाबर': 'Babar',
  'वाळुंज': 'Walunj',
  'शितोळे': 'Shitole',
  'धमाले': 'Dhamale',
  'कराळे': 'Karale',
  'शिंगाटे': 'Shingate',
  'गव्हाणे': 'Gavhane',
  'नलावडे': 'Nalawade',
  'शिंत्रे': 'Shintre',
  'खोट': 'Khot',
  'चाळके': 'Chalke',
  'दळवी': 'Dalvi',
  'राणे': 'Rane',
  'परब': 'Parab',
  'गुरव': 'Gurav',
  'कुंभार': 'Kumbhar',
  'सुतार': 'Sutar',
  'लोहार': 'Lohar',
  'न्हावी': 'Nhavi',
  'सोनार': 'Sonar',
  'कोष्टी': 'Koshti',
  'माळी': 'Mali',
  'तेली': 'Teli',
  'धनगर': 'Dhangar',
  'वंजारी': 'Vanjari',
  'मराठे': 'Marathe',
  'शिंदेकर': 'Shindekar',
  'पाटीलकर': 'Patilkar',
  'जोशीबुवा': 'Joshibuwa',
  'आंधळे': 'Andhale',
  'आवटे': 'Awate',
  'आव्हाड': 'Avhad',
  'उबाळे': 'Ubale',
  'कापसे': 'Kapse',
  'केदारी': 'Kedari',
  'खंदारे': 'Khandare',
  'गाडे': 'Gade',
  'गुंजाळ': 'Gunjal',
  'चोरे': 'Chore',
  'जगधने': 'Jagdhane',
  'जांगळे': 'Jangle',
  'डफळ': 'Daphal',
  'ताकवले': 'Takawale',
  'दळवे': 'Dalve',
  'नरवडे': 'Narwade',
  'पडवळ': 'Padwal',
  'पावसे': 'Pawase',
  'फुंदे': 'Phunde',
  'बढे': 'Badhe',
  'भोर': 'Bhor',
  'मुंडे': 'Munde',
  'येवले': 'Yewale',
  'रानडे': 'Ranade',
  'लहाने': 'Lahane',
  'वाळके': 'Walke',
  'शिरसाट': 'Shirsat',
  'ससाणे': 'Sasane',
  'हिंगे': 'Hinge',

  // Common First & Middle Names (Male)
  'राम': 'Ram',
  'लक्ष्मण': 'Laxman',
  'भरत': 'Bharat',
  'शत्रुघ्न': 'Shatrughna',
  'दत्तात्रय': 'Dattatray',
  'ज्ञानेश्वर': 'Dnyaneshwar',
  'ज्ञानोबा': 'Dnyanoba',
  'तुकडोजी': 'Tukdoji',
  'विठ्ठल': 'Vitthal',
  'विठोबा': 'Vithoba',
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
  'सचin': 'Sachin',
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
  'अशोक': 'Ashok',
  'संभाजी': 'Sambhaji',
  'शिवाजी': 'Shivaji',
  'तानाजी': 'Tanaji',
  'बाळासाहेब': 'Balasaheb',
  'रावसाहेब': 'Raosaheb',
  'भाऊसाहेब': 'Bhausaheb',
  'बाबासाहेब': 'Babasaheb',
  'अण्णासाहेब': 'Annasaheb',
  'दादासाहेब': 'Dadasaheb',
  'आप्पासाहेब': 'Appasaheb',
  'जगन्नाथ': 'Jagannath',
  'सोमनाथ': 'Somnath',
  'गोरखनाथ': 'Gorakhnath',
  'नवनाथ': 'Navnath',
  'भगवान': 'Bhagwan',
  'शंकर': 'Shankar',
  'महादेव': 'Mahadev',
  'पांडुरंग': 'Pandurang',
  'पंढरीनाथ': 'Pandharinath',
  'काशिनाथ': 'Kashinath',
  'बबन': 'Baban',
  'बाळू': 'Balu',
  'बाबुराव': 'Baburao',
  'आनंदराव': 'Anandrao',
  'आनंद': 'Anand',
  'गणपत': 'Ganpat',
  'गणपतराव': 'Ganpatrao',
  'सदाशिव': 'Sadashiv',
  'आप्पा': 'Appa',
  'बापू': 'Bapu',
  'नाना': 'Nana',
  'दादा': 'Dada',
  'भाऊ': 'Bhau',
  'तात्या': 'Tatya',
  'अण्णा': 'Anna',
  'विष्णू': 'Vishnu',
  'गोपाळ': 'Gopal',
  'नारायण': 'Narayan',
  'प्रभाकर': 'Prabhakar',
  'भास्कर': 'Bhaskar',
  'मधुकर': 'Madhukar',
  'सुधाकर': 'Sudhakar',
  'मोहन': 'Mohan',
  'मदन': 'Madan',
  'देविदास': 'Devidas',
  'रामदास': 'Ramdas',
  'हरिदास': 'Haridas',
  'रोहिदास': 'Rohidas',
  'कालिदास': 'Kalidas',
  'गोविंद': 'Govind',
  'पंकज': 'Pankaj',
  'हर्षल': 'Harshal',
  'चेतन': 'Chetan',
  'मयूर': 'Mayur',
  'रोशन': 'Roshan',
  'सौरभ': 'Saurabh',
  'शुभम': 'Shubham',
  'अक्षय': 'Akshay',
  'वैभव': 'Vaibhav',
  'रोहित': 'Rohit',
  'नितीन': 'Nitin',
  'सागर': 'Sagar',
  'सुजित': 'Sujit',
  'अजित': 'Ajit',
  'अभिजीत': 'Abhijit',
  'सिद्धार्थ': 'Siddharth',
  'अर्जुन': 'Arjun',
  'ओंकार': 'Omkar',
  'प्रणव': 'Pranav',

  // Common First & Middle Names (Female)
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
  'मनीषा': 'Manisha',
  'अर्चना': 'Archana',
  'वंदना': 'Vandana',
  'सुरेखा': 'Surekha',
  'रेखा': 'Rekha',
  'उषा': 'Usha',
  'आशा': 'Asha',
  'लता': 'Lata',
  'मीना': 'Meena',
  'सीमा': 'Seema',
  'छाया': 'Chhaya',
  'शोभा': 'Shobha',
  'मंगल': 'Mangal',
  'विजया': 'Vijaya',
  'सरिता': 'Sarita',
  'सविता': 'Savita',
  'स्मिता': 'Smita',
  'दिपाली': 'Dipali',
  'दीपाली': 'Deepali',
  'शुभंगी': 'Shubhangi',
  'सुजाता': 'Sujata',
  'कल्पना': 'Kalpana',
  'जयश्री': 'Jayshree',
  'भारती': 'Bharati',
  'प्रतिभा': 'Pratibha',
  'शैला': 'Shaila',
  'रोहिणी': 'Rohini',
  'प्रतिमा': 'Pratima',
  'पल्लवी': 'Pallavi',
  'तेजस्विनी': 'Tejaswini',
  'कोमल': 'Komal',
  'काजल': 'Kajal',
  'वर्षा': 'Varsha',
  'विद्या': 'Vidya',
  'अनुराधा': 'Anuradha',
  'सारिका': 'Sarika',
  'शारदा': 'Sharada',
  'पार्वती': 'Parvati',
  'रुक्मिणी': 'Rukmini',
  'लक्ष्मी': 'Laxmi',
  'सखूबाई': 'Sakhubai',
  'गंगूबाई': 'Gangubai',
  'शांताबाई': 'Shantabai',
  'कमल': 'Kamal',
  'कौशल्या': 'Kaushalya',
  'मंदा': 'Manda',
  'कुसुम': 'Kusum',
  'सिंधू': 'Sindhu'
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
      } else if (nextChar === 'ं') {
        // Anusvara directly on independent consonant (e.g. 'सं', 'पं', 'मं') represents 'an' sound
        result += base + 'an';
        i++; // skip anusvara
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

