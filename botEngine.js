// Companion Bot Personality Engine
const COMPANIONS = {
  roaster: {
    id: 'roaster',
    name: 'Rian si Roaster',
    avatar: '🦊',
    title: 'Sahabat Sarkas & Realistis',
    status: 'Siap ngeroast kenyataan pahitmu',
    tagline: 'Gue jujur bukan jahat, kalo sakit ya maap!',
    theme: 'amber',
    quickPrompts: [
      '🔥 Roast Saya Dong!',
      'Gue mager banget ngerjain tugas',
      'Masih sering kepikiran mantan',
      'Bokek tapi pengen beli kopi mahal'
    ]
  },
  melow: {
    id: 'melow',
    name: 'Bella si Melow',
    avatar: '🌸',
    title: 'Sahabat Curhat & Pendengar Setia',
    status: 'Mendengarkan dengan sepenuh hati',
    tagline: 'Nangis aja gak apa-apa, kamu berharga kok.',
    theme: 'rose',
    quickPrompts: [
      '💌 Butuh Tempat Curhat',
      'Capek banget rasanya hari ini',
      'Ngerasa gak ada yang peduli',
      'Minta pelukan hangat virtual'
    ]
  },
  hustle: {
    id: 'hustle',
    name: 'Devan si Ambis',
    avatar: '⚡',
    title: 'Motivator & Anti-Mager',
    status: 'Gaspol 100% no excuses!',
    tagline: 'Rebahan gak bikin kaya, bangun sekarang!',
    theme: 'emerald',
    quickPrompts: [
      '🚀 Kasih Motivasi Keras!',
      'Lagi gak ada mood buat belajar/kerja',
      'Gimana cara konsisten tiap hari?',
      'Bikin challenge 15 menit sekarang'
    ]
  },
  kawaii: {
    id: 'kawaii',
    name: 'Hana si Wibu',
    avatar: '🎀',
    title: 'Teman Ceria Anime & Manga',
    status: 'UwU~ Senpai daisuki!',
    tagline: 'Hidup ini ibarat anime isekai, seru banget!',
    theme: 'purple',
    quickPrompts: [
      '🎌 Rekomendasi Anime Sedih',
      'Siapa waifu terbaik season ini?',
      'Mau curhat ala drama anime',
      'Ganbatte dong buat aku!'
    ]
  },
  bapack: {
    id: 'bapack',
    name: 'Pak Budi Bapack',
    avatar: '☕',
    title: 'Tetangga Santai & Pelawak Garing',
    status: 'Lagi ngopi di teras rumah',
    tagline: 'Hidup itu santai le, jangan dibikin tegang.',
    theme: 'cyan',
    quickPrompts: [
      '😂 Lempar Tebak-Tebakan Garing!',
      'Pak, saya pusing mikirin hidup',
      'Resep kopi hitam terenak apa pak?',
      'Cerita masa muda bapak dong'
    ]
  },
  mistik: {
    id: 'mistik',
    name: 'Ki Ageng Mistik',
    avatar: '🔮',
    title: 'Peramal Hoki & Cek Khodam Lucu',
    status: 'Menyalakan dupa virtual...',
    tagline: 'Melihat auramu bergeser ke arah kemakmuran!',
    theme: 'violet',
    quickPrompts: [
      '🔮 Ramal Keberuntungan Hari Ini',
      'Cek Khodam Lucu Saya',
      'Bakal dapet jodoh kapan ya ki?',
      'Tarik Kartu Ramalan'
    ]
  }
};

const TEBAKAN_BAPACK = [
  { q: 'Kenapa matahari tenggelam?', a: 'Karena gak bisa berenang! Haha! ☕😂' },
  { q: 'Pohon apa yang paling banyak muncul di hari raya?', a: 'Pohon maaf lahir dan batin ya le! Mantap kan!' },
  { q: 'Benda apa yang kalau dibeli warnanya hitam, dipake warnanya merah, dibuang warnanya abu-abu?', a: 'Arang briket bakar sate! Hehe!' },
  { q: 'Ikan apa yang matanya banyak banget?', a: 'Ikan teri sekilo dicampur! 😂☕' },
  { q: 'Kenapa air laut rasanya asin?', a: 'Karena ikannya pada keringetan pas dikejar hiu! Wkwkwk jempol buat bapack ya!' }
];

const ROAST_TEMPLATES = [
  'Waduh bro, keluhan lu ini 90% drama, 10% kemalasan. Coba cuci muka dulu, kaca di kamar masih utuh kan? Jangan nyalahin semesta mulu, semesta juga pusing liat lu rebahan!',
  'Lu bilang mau sukses, tapi scrolling TikTok udah 4 jam tanpa jeda sampe jempol kapalan. Malaikat pencatat takdir sampe geleng-geleng kepala liat resolusi lu!',
  'Diet lu itu ibarat mitos Atlantis bro, cuma dibahas terus tapi gak pernah ada bukti fisiknya! Begitu liat gorengan langsung lupa daratan.',
  'Masih mikirin mantan? Bro, dia aja udah ganti pasangan 3 kali, lu masih dengerin playlist lagu galau tahun 2018. Bangun hei!',
  'Pengen kaya jalur cepat tapi ngerjain tugas aja nunggu H-5 menit deadline. Lu mau kaya atau mau dapet serangan jantung dini?'
];

const RAMALAN_TEMPLATES = [
  'Ki Ageng melihat... Aura birumu hari ini dikelilingi Khodam Kucing Oren Pemalas! Hindari rebahan berlebih sebelum rezekimu dipatok ayam tetangga! Angka hoki: 77.',
  'Setelah membakar dupa digital... Jodohmu sebenarnya sudah dekat, radius 3 km, tapi kalian berdua sama-sama gengsi dan gak pernah keluar kamar! Segera hirup udara luar!',
  'Kartu Tarot hari ini: "Sang Cangkir Kopi Hangat". Artinya: Masalahmu hari ini tidak seberat itu, pikiranmu saja yang terlalu heboh bikin skenario sinetron.',
  'Khodam pendampingmu hari ini adalah: "Garpu Somay Sakti"! Menandakan bahwa perutmu butuh jajan enak biar mood-mu kembali bersinar!'
];

function generateCompanionReply(characterId, userMessage, userName = 'Kawan') {
  const text = (userMessage || '').toLowerCase();
  const char = COMPANIONS[characterId] || COMPANIONS.roaster;

  // 1. RIAN SI ROASTER
  if (characterId === 'roaster') {
    if (text.includes('roast') || text.includes('hina') || text.includes('sindir') || text.includes('savage')) {
      const r = ROAST_TEMPLATES[Math.floor(Math.random() * ROAST_TEMPLATES.length)];
      return `🔥 *Roast Spesial buat ${userName}:*\n"${r}"\n\nGimana? Pedes gak? Tapi inget, gue ngomong begini biar lu bangkit, bukan malah makin lemes! Ayo gerak! 🦊`;
    }
    if (text.includes('mager') || text.includes('malas') || text.includes('rebahan') || text.includes('tidur')) {
      return `Mager mulu heran gue! Kasur lu emang punya magnet 500 Tesla apa gimana, ${userName}? Tugas gak bakal selesai sendiri disulap peri Tinkerbell. Berdiri sekarang, minum air putih, buka laptop! 🦊💥`;
    }
    if (text.includes('mantan') || text.includes('galau') || text.includes('crush') || text.includes('cinta')) {
      return `Halah bahas mantan lagi! Lu tuh cuma kangen memorinya, bukan orangnya! Kalau emang dia peduli, lu gak bakal dibikin galau sendirian gini. Hapus arsip chatnya, hargai diri lu sendiri woy! 🦊`;
    }
    if (text.includes('uang') || text.includes('duit') || text.includes('bokek') || text.includes('miskin') || text.includes('jajan')) {
      return `Ngakunya bokek tapi kemarin checkout barang diskon 200 perak yang gak berguna sama sekali! Kuncinya gampang: stop FOMO jajan kopi 45 ribu tiap sore kalau saldo ATM lu masih 2 digit! 🦊☕`;
    }
    if (text.includes('hai') || text.includes('halo') || text.includes('p') || text.includes('salam')) {
      return `Halo ${userName}! Mau ngobrol berfaedah atau mau numpang ngeluh doang nih? Santai aja, gue dengerin, tapi siap-siap mental ya kalau solusinya rada to-the-point! 🦊👊`;
    }
    return `Hmm menarik juga apa yang lu bilang tadi, "${userMessage}". Intinya sih gini, ${userName}, jangan terlalu pusingin apa kata orang lain kalau mereka gak bayarin tagihan hidup lu. Fokus beresin apa yang ada di depan mata dulu! 🦊`;
  }

  // 2. BELLA SI MELOW
  if (characterId === 'melow') {
    if (text.includes('curhat') || text.includes('nangis') || text.includes('sedih') || text.includes('kecewa')) {
      return `Hai ${userName} 🌸... Duduk yang nyaman ya. Tarik nafas perlahan... Lepaskan semua beban di dadamu. Menangis bukan tanda kamu lemah, itu cara jiwamu melepaskan rasa lelah yang terpendam. Aku ada di sini, cerita aja semuanya ya? 🤍`;
    }
    if (text.includes('capek') || text.includes('lelah') || text.includes('berat') || text.includes('burnout')) {
      return `Hari ini terasa begitu berat ya buatmu, ${userName}? Peluk hangat virtual dari aku 🤗🌸. Kamu sudah berusaha luar biasa hebat hari ini. Kalau lelah, istirahatlah sejenak, jangan memaksa diri terlalu keras ya.`;
    }
    if (text.includes('kesepian') || text.includes('sendiri') || text.includes('sepi') || text.includes('teman')) {
      return `Kamu tidak benar-benar sendirian, ${userName}. Di malam yang hening sekalipun, selalu ada harapan dan aku senang bisa menemani langkahmu di sini. Selalu ada ruang hangat buatmu kapanpun kamu butuh didengar ✨🌸.`;
    }
    if (text.includes('hai') || text.includes('halo') || text.includes('pagi') || text.includes('malam')) {
      return `Halo ${userName} yang manis 🌸. Senang banget kamu menyapa. Bagaimana perasaan hatimu hari ini? Semoga hari ini membawa sedikit ketenangan dan senyuman buatmu ya.`;
    }
    return `Aku mendengarkan setiap katamu, ${userName}. Kadang hidup memang penuh teka-teki ya. Yang terpenting, jangan lupa berterima kasih pada dirimu sendiri karena sudah bertahan sejauh ini 🌸✨.`;
  }

  // 3. DEVAN SI AMBIS
  if (characterId === 'hustle') {
    if (text.includes('motivasi') || text.includes('semangat') || text.includes('keras') || text.includes('gas')) {
      return `🔥 GASKEN BRO ${userName}!! Juara sejati tidak diciptakan di zona nyaman! Rasa sakit saat disiplin jauh lebih ringan daripada rasa sakit penyesalan di masa depan! Pasang timer sekarang, buktikan ke dirimu sendiri kamu bisa! ⚡🚀`;
    }
    if (text.includes('mager') || text.includes('malas') || text.includes('tunda') || text.includes('nanti')) {
      return `STOP PROKRASTINASI! "Nanti" itu jebakan Batman! Lu cuma butuh mulai 5 menit pertama. Begitu roda momentum jalan, lu bakal tak terbendung! Buka tugas/proyek lu sekarang juga, NO DEBATE! ⚡⏱️`;
    }
    if (text.includes('target') || text.includes('sukses') || text.includes('karir') || text.includes('bisnis') || text.includes('cuan')) {
      return `Bagus! Mindset lu udah di jalur yang benar! Tulis 3 aksi prioritas lu untuk hari ini. Jangan tidur sebelum 3 tugas itu beres dicentang! Ingat: Eksekusi > Sekadar Rencana! Siap gaspol? ⚡💼`;
    }
    if (text.includes('hai') || text.includes('halo') || text.includes('siang') || text.includes('pagi')) {
      return `Pagi/Siang yang produktif ${userName}! Apa gol terbesar yang mau lu hancurkan hari ini? Ayo sharing sama gue, kita bedah strateginya bareng! ⚡🔥`;
    }
    return `Mantap ${userName}! Apapun tantangan di depanmu tadi, jadikan itu bahan bakar buat naik level! Orang biasa menyerah saat lelah, pemenang baru berhenti saat garis finish tercapai! Let's GO! ⚡`;
  }

  // 4. HANA SI WIBU
  if (characterId === 'kawaii') {
    if (text.includes('anime') || text.includes('rekomendasi') || text.includes('nonton') || text.includes('manga')) {
      return `Kyaaa~! Senpai ${userName} mau rekomendasi anime ya? 🎀✨\n1. Kalau mau ketawa: *Spy x Family* atau *Bocchi the Rock!*\n2. Kalau mau seru action: *Jujutsu Kaisen* atau *Chainsaw Man*!\n3. Kalau mau mewek: *Frieren* atau *Violet Evergarden*!\nMau nonton yang mana nih senpai? UwU~`;
    }
    if (text.includes('ganbatte') || text.includes('semangat') || text.includes('dukung')) {
      return `GANBATTE SENPAI ${userName}!! ٩(◕‿◕｡)۶! Hana selalu kirim energi positif genki buat senpai! Senpai itu kuat seperti pahlawan shonen! Yosh, pantang menyerah ya! ✨🎀`;
    }
    if (text.includes('waifu') || text.includes('husbando') || text.includes('wibu')) {
      return `Ehehehe wibu sejati bersatu! Siapa nih waifu/husbando nomor 1 di hati senpai saat ini? Jangan bilang punya satu per musim anime ya kayak meme wibu, baka! (≧◡≦) ♡`;
    }
    if (text.includes('hai') || text.includes('halo') || text.includes('konnichiwa') || text.includes('moshi')) {
      return `Konnichiwaaa ${userName}-senpai! (*^ω^*)🌸 Senang banget senpai mampir ke ruangan Hana! Hari ini mau ngobrol santai atau mau cerita anime terbaru nih? UwU!`;
    }
    return `Sugoi ne, ${userName}-senpai! Hana suka banget cara senpai mengekspresikan diri! Arigato gozaimasu udah ngobrol bareng Hana, hari Hana jadi berwarna banget! (っ˘ω˘ς )🎀`;
  }

  // 5. PAK BUDI BAPACK
  if (characterId === 'bapack') {
    if (text.includes('tebak') || text.includes('jokes') || text.includes('lucu') || text.includes('lelucon')) {
      const tb = TEBAKAN_BAPACK[Math.floor(Math.random() * TEBAKAN_BAPACK.length)];
      return `Hahaha! Nih bapack kasih tebakan mumpung kopi masih anget:\n\n❓ *Tebakan:* "${tb.q}"\n💡 *Jawabannya:* "${tb.a}"\n\nGimana le? Lucu kan? Wkwkwk jempol dulu buat bapack! 👍☕`;
    }
    if (text.includes('kopi') || text.includes('santai') || text.includes('istirahat') || text.includes('rokok')) {
      return `Nah ini baru mantap le ${userName}! Kopi hitam kapal api tanpa gula sedikit, diseruput sore-sore sambil dengerin suara burung perkutut. Masalah dunia lunas seketika! Hidup itu nikmat kalau disyukuri toh! ☕👍`;
    }
    if (text.includes('pusing') || text.includes('stres') || text.includes('kerjaan') || text.includes('kantor')) {
      return `Oalah le ${userName}, jangan terlalu dipikirin sampe urat dahi keliatan. Dulu bapack juga sering puyeng pas muda, kuncinya satu: kerjain pelan-pelan, kalau jam 5 sore ya tenggo pulang! Sehat nomor satu le! ☕👴`;
    }
    if (text.includes('hai') || text.includes('halo') || text.includes('salam') || text.includes('pak')) {
      return `Halo le ${userName}! Sini duduk dulu di dipan teras, bapack tuangin kopi anget nih. Gimana kabar hari ini? Aman terkendali kan semuanya? ☕👍`;
    }
    return `Walah begitu ya ceritanya le ${userName}. Bapack setuju sih, yang penting dalam hidup itu rukun sama tetangga, jangan lupa senyum, dan sering-sering bersyukur. Mantap! 👍☕`;
  }

  // 6. KI AGENG MISTIK
  if (characterId === 'mistik') {
    if (text.includes('khodam') || text.includes('cek')) {
      const khodams = [
        'Khodam Kucing Belang Tiga Pencuri Ikan Tongkol 🐟',
        'Khodam Kipas Angin Cosmos No. 3 yang Bunyinya Gemerincing 🌀',
        'Khodam Cicak Dinding Pemantau Asmara Kamar Kos 🦎',
        'Khodam Kerupuk Kaleng Renyah Anti-Masuk Angin 🥫',
        'Khodam Sapu Lidi Sakti Pembabat Kemalasan 🧹'
      ];
      const k = khodams[Math.floor(Math.random() * khodams.length)];
      return `🔮 *HASIL PENERAWANGAN GAIB KI AGENG:*\nBerdasarkan getaran frekuensi gaib, Khodam yang sedang nempel di pundakmu adalah:\n✨ **${k}** ✨\n\nTuahnya: Memberimu rezeki dadakan dan menjauhkanmu dari godaan pinjol! Rawatlah dengan rajin sedekah! 🔮🕯️`;
    }
    if (text.includes('ramal') || text.includes('zodiak') || text.includes('hoki') || text.includes('jodoh') || text.includes('nasib')) {
      const r = RAMALAN_TEMPLATES[Math.floor(Math.random() * RAMALAN_TEMPLATES.length)];
      return `🔮 *RAMALAN MISTIK HARI INI BUAT ${userName.toUpperCase()}:*\n${r}\n\nIngat: Nasib ada di tangan Yang Maha Kuasa, Ki Ageng cuma membaca getaran kopinya saja! Hehehe 🕯️✨`;
    }
    if (text.includes('hai') || text.includes('halo') || text.includes('ki') || text.includes('mbah')) {
      return `Rahayu, salam kebajikan anak muda ${userName}... Ki Ageng mencium aroma pertanyaan besar dalam hatimu. Masuklah ke bilik mistik ini, apa yang ingin kamu terawang hari ini? 🔮🕯️`;
    }
    return `Hmm... Getaran auramu berbunyi "klunting-klunting", ${userName}. Pertanda ada energi baik yang sedang menuju ke arahmu dalam kurun waktu 48 jam ke depan! Tetap berbuat baik ya anak cucu! 🔮✨`;
  }

  return `Halo ${userName}! Senang sekali bisa ngobrol santai denganmu. Ada hal seru apa yang mau kita bahas sekarang?`;
}

module.exports = {
  COMPANIONS,
  generateCompanionReply
};
