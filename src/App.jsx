import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { Volume2, Check, X, Plus, Trash2, Edit2, BookOpen, Album, Brain, GraduationCap, Star, Eye, Settings, Gift, Target, TrendingUp, Award, Calendar, BarChart3, Shuffle, Headphones, Pencil, Lightbulb, ClipboardList, CheckCircle, Book } from 'lucide-react';
import * as XLSX from 'xlsx';


// Firebase 설정
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 동의어/반의어 가져오기 함수 추가
const fetchSynonymsAndAntonyms = async (word) => {
  try {
    const synResponse = await fetch(
      `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=5`
    );
    let synonyms = [];
    if (synResponse.ok) {
      const synData = await synResponse.json();
      if (Array.isArray(synData)) {
        synonyms = synData.map(s => s.word).slice(0, 5);
      }
    }

    const antResponse = await fetch(
      `https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}&max=5`
    );
    let antonyms = [];
    if (antResponse.ok) {
      const antData = await antResponse.json();
      if (Array.isArray(antData)) {
        antonyms = antData.map(a => a.word).slice(0, 5);
      }
    }

    return { synonyms, antonyms };
  } catch (err) {
    console.error('API 호출 실패:', err);
    return { synonyms: [], antonyms: [] };
  }
};

// 품사 표시 제거 함수 ([명], [동], [형], [부] 등)
const removePartOfSpeechTags = (text) => {
  if (!text) return text;
  // [명], [동], [형], [부], [전], [접], [감], [대], [관], [조] 등 모든 한글 품사 표시 제거
  // (명), (동) 같은 형태도 제거
  return text
    .replace(/\[[가-힣]+\]/g, '') // [명], [동] 등 제거
    .replace(/\([가-힣]+\)/g, '') // (명), (동) 등 제거
    .trim(); // 앞뒤 공백 제거
};
export default function MineVocaApp() {

  useEffect(() => {
  const existingFavicons = document.querySelectorAll("link[rel*='icon']");
  existingFavicons.forEach(favicon => favicon.remove());
  
  const favicon32 = document.createElement('link');
  favicon32.type = 'image/png';
  favicon32.rel = 'icon';
  favicon32.sizes = '32x32';
  favicon32.href = '/favicon-32x32.png?v=' + new Date().getTime();
  document.head.appendChild(favicon32);
  
  const favicon64 = document.createElement('link');
  favicon64.type = 'image/png';
  favicon64.rel = 'icon';
  favicon64.sizes = '64x64';
  favicon64.href = '/favicon-64x64.png?v=' + new Date().getTime();
  document.head.appendChild(favicon64);
  
  const appleTouchIcon = document.createElement('link');
  appleTouchIcon.rel = 'apple-touch-icon';
  appleTouchIcon.sizes = '180x180';
  appleTouchIcon.href = '/apple-touch-icon.png?v=' + new Date().getTime();
  document.head.appendChild(appleTouchIcon);
  
  document.title = 'Mine Voca';
}, []);



  // 인증 관련 상태
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [authView, setAuthView] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ 
    email: '', 
    name: '', 
    password: '', 
    confirmPassword: ''
  });
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);



  // 앱 상태
  const [currentView, setCurrentView] = useState('home');
  const [selectedBook, setSelectedBook] = useState(null);
 const [books, setBooks] = useState([]);
  const [showBookInput, setShowBookInput] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [editingWordId, setEditingWordId] = useState(null);
const [examName, setExamName] = useState('');
const [examDate, setExamDate] = useState('');
const [showExamModal, setShowExamModal] = useState(false);

// 출석 관련 상태
const [classId, setClassId] = useState('');
const [className, setClassName] = useState('');
const [todayAttendance, setTodayAttendance] = useState([]);
const [weeklyChampion, setWeeklyChampion] = useState(null); // { userName: '철수', count: 5 }

// 오답노트 관련 상태
const [wrongNoteSearchQuery, setWrongNoteSearchQuery] = useState('');

const startEditing = (book) => {
  setEditingBook({ ...book });
  setShowEditModal(true);
};

  

 // 아이콘 선택 옵션들
  const bookIcons = ['📒', '📘', '📗', '📙', '📕', '📓', '📔', '🗂️', '📚', '🎯', '⭐', '🌟', '💫', '✨', '🔥', '💪', '🎨', '🎭', '🎪', '🎬'];

 // 단어장 수정
  const updateBook = async () => {
  if (editingBook && editingBook.name.trim()) {
    const updatedBooks = books.map(b => 
      b.id === editingBook.id 
        ? { ...b, name: editingBook.name, icon: editingBook.icon || '📒' }
        : b
    );
    setBooks(updatedBooks);
    setEditingBook(null);
    setShowEditModal(false);
    
    try {
      await window.storage.set('books', JSON.stringify(updatedBooks));
    } catch (error) {
      console.error('Failed to save:', error);
    }
  }
};

// 수정 취소 함수 추가
const cancelEdit = () => {
  setEditingBook(null);
  setShowEditModal(false);
};

  // 관리자 페이지 상태
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [allWords, setAllWords] = useState([]);
  const [editingWord, setEditingWord] = useState(null);
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [selectedWordIds, setSelectedWordIds] = useState([]); // 체크박스 선택된 단어들
  const [isBulkEditMode, setIsBulkEditMode] = useState(false); // 일괄 수정 모드

  // 홈 화면 섹션 접기/펼치기 상태
  const [expandedSections, setExpandedSections] = useState({
    learning: true,   // 학습 단어장
    textbook: true,   // 교재 단어장
    memorized: true,  // 암기완료 단어장
    wrongNote: true   // 오답노트
  });

  // 반 관리 상태
  const [classes, setClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [showClassForm, setShowClassForm] = useState(false);
  
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState({ english: '', korean: '', example: '', pronunciation: '' });
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizResult, setQuizResult] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);

  // 학습 통계 상태
  const [learningStats, setLearningStats] = useState({
    todayStudied: 0,
    weekStudied: 0,
    monthStudied: 0,
    totalStudied: 0,
    streak: 0,
    lastStudyDate: null,
    studyHistory: [],
  });

  // 퀴즈 모드 상태
  const [quizMode, setQuizMode] = useState('typing');
  const [quizDirection, setQuizDirection] = useState('en-ko');
  const [multipleChoices, setMultipleChoices] = useState([]);
  const [spellingInput, setSpellingInput] = useState([]); // 선택 가능한 철자들 (섞인 상태)
  const [selectedLetters, setSelectedLetters] = useState([]); // 사용자가 선택한 철자 순서
  const [quizWords, setQuizWords] = useState([]); // 섞인 퀴즈용 단어 배열
  const [quizResults, setQuizResults] = useState(null); // 퀴즈 결과 저장

  // 🆕 관리자용 학생 목록 상태
  const [students, setStudents] = useState([]);

  // 단어 시험 상태
  const [wordTests, setWordTests] = useState([]); // 관리자가 만든 시험 목록
  const [currentTest, setCurrentTest] = useState(null); // 현재 진행 중인 시험 (학생용)
  const [allTests, setAllTests] = useState([]); // 모든 시험 목록 (관리자용)
  const [myTestResults, setMyTestResults] = useState([]); // 내 시험 결과 목록

  // 시험 만들기 폼 상태
  const [testTitle, setTestTitle] = useState('');
  const [testDeadline, setTestDeadline] = useState('');
  const [selectedTestWordIds, setSelectedTestWordIds] = useState([]);
  const [selectedTestClassId, setSelectedTestClassId] = useState(''); // 시험 대상 반
  const [testType, setTestType] = useState('regular'); // 'regular' | 'retest'
  const [selectedTestBookIds, setSelectedTestBookIds] = useState([]); // 선택된 단어장 IDs
  const [testWordCount, setTestWordCount] = useState(10); // 일반 시험 단어 개수
  const [selectedRetestStudentIds, setSelectedRetestStudentIds] = useState([]); // 재시험 학생 선택

  // 교재단어장 엑셀 업로드 상태
  const [excelUploadStatus, setExcelUploadStatus] = useState('');
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const [selectedUploadClassId, setSelectedUploadClassId] = useState('');

  // 반별 단어장 관리 상태
  const [selectedClassForBooks, setSelectedClassForBooks] = useState('');
  const [classBooks, setClassBooks] = useState([]);
  const [isLoadingClassBooks, setIsLoadingClassBooks] = useState(false);

  // 관리자 로그인
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD; 

 const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setCurrentView('admin');
      loadAllStudents(); // 🆕 학생 목록 로드
    } else {
      alert('비밀번호가 틀렸습니다!');
    }
  };

  // CSV 파일 업로드 및 처리
  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('📂 파일 읽는 중...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      const dataLines = lines.slice(1).filter(line => line.trim());
      
      setUploadStatus(`⚡ 총 ${dataLines.length}개 단어 빠른 저장 중...`);

      let newCount = 0;      // 새로 추가된 단어
      let updatedCount = 0;  // 뜻이 업데이트된 단어
      let skippedCount = 0;  // 이미 존재하는 단어 (변경 없음)
      let failCount = 0;

      const promises = dataLines.map(async (line, index) => {
        // 모든 종류의 공백 문자 제거 (일반 공백, \r, \n, 탭 등)
        const cleanLine = line.replace(/\r/g, '').trim();
        const parts = cleanLine.split(',');
        if (parts.length < 2) {
          failCount++;
          return;
        }
        // 따옴표 제거 및 공백 정리
        const english = parts[0].trim().replace(/^["']|["']$/g, '').trim();
        const korean = parts.slice(1).join(',').trim().replace(/^["']|["']$/g, '').trim();

        if (!english || !korean) {
          failCount++;
          return;
        }

        try {
          const wordKey = english.toLowerCase().trim(); // 이중 trim
          const wordRef = doc(db, 'dictionary', wordKey);

          // 기존 단어가 있는지 확인
          const existingDoc = await getDoc(wordRef);

          if (existingDoc.exists()) {
            // 이미 있으면 뜻 합치기
            const existingData = existingDoc.data();
            const existingKorean = existingData.korean || '';

            // 중복 체크: 이미 같은 뜻이 있으면 추가 안 함
            const koreanMeanings = existingKorean.split(',').map(m => m.trim());
            if (!koreanMeanings.includes(korean)) {
              const combinedKorean = existingKorean + ', ' + korean;

              await setDoc(wordRef, {
                ...existingData,
                korean: combinedKorean,
                updatedAt: new Date().toISOString()
              });
              updatedCount++;  // 뜻이 업데이트됨
            } else {
              skippedCount++;  // 이미 같은 뜻이 있어서 건너뜀
            }
          } else {
            // 새 단어 추가
            await setDoc(wordRef, {
              english: english,
              korean: korean,
              pronunciation: '',
              createdAt: new Date().toISOString()
            });
            newCount++;  // 새로 추가됨
          }

          if (index % 10 === 0) {
            setUploadStatus(`⚡ 저장 중... ${index + 1}/${dataLines.length}`);
          }

        } catch (error) {
          console.error(`단어 저장 실패: ${english}`, error);
          failCount++;
        }
      });

      await Promise.all(promises);

      setUploadStatus(`✅ 완료!\n🆕 새 단어: ${newCount}개\n📝 뜻 추가: ${updatedCount}개\n⏭️ 건너뜀: ${skippedCount}개\n❌ 실패: ${failCount}개`);
      setIsUploading(false);
      
      setTimeout(() => {
        setUploadStatus(prev => prev + '\n\n💡 발음기호는 학생들이 단어를 입력할 때 자동으로 추가됩니다!');
      }, 1000);
    };

    reader.readAsText(file);
  };

  // 엑셀 파일로 교재단어장 자동 생성 및 단어 추가
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!selectedUploadClassId) {
      alert('반을 먼저 선택해주세요.');
      event.target.value = '';
      return;
    }

    setIsExcelUploading(true);
    setExcelUploadStatus('📂 엑셀 파일 읽는 중...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // 파일명에서 단어장 이름 추출 (.xlsx, .xls 제거)
      const bookName = file.name.replace(/\.(xlsx|xls)$/i, '').trim();

      if (!bookName) {
        setExcelUploadStatus('❌ 파일명이 비어있습니다.');
        setIsExcelUploading(false);
        return;
      }

      // 헤더 제외하고 데이터만 추출
      const dataRows = jsonData.slice(1).filter(row => row.length >= 2 && row[0] && row[1]);

      if (dataRows.length === 0) {
        setExcelUploadStatus('❌ 엑셀 파일에 단어가 없습니다.\n\n📋 열 순서:\n1열: 영어\n2열: 한글 뜻\n3열: 동의어 (선택, 쉼표로 구분)\n4열: 반의어 (선택, 쉼표로 구분)\n5열: 영영풀이 (선택)');
        setIsExcelUploading(false);
        return;
      }

      setExcelUploadStatus(`📚 "${bookName}" 단어장 생성 중...\n총 ${dataRows.length}개 단어`);

      // 선택된 반의 학생 목록 가져오기
      const selectedClass = classes.find(c => c.id === selectedUploadClassId);
      if (!selectedClass) {
        setExcelUploadStatus('❌ 선택된 반 정보를 찾을 수 없습니다.');
        setIsExcelUploading(false);
        return;
      }

      // classes.students 배열과 userData.classId 모두에서 학생 찾기
      setExcelUploadStatus(`🔍 "${selectedClass.className}" 반 학생 검색 중...`);
      let studentIds = [...(selectedClass.students || [])];

      // userData에서 해당 반에 속한 학생들도 찾기
      const userDataSnapshot = await getDocs(collection(db, 'userData'));
      userDataSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.classId === selectedUploadClassId && !studentIds.includes(doc.id)) {
          studentIds.push(doc.id);
        }
      });

      if (studentIds.length === 0) {
        setExcelUploadStatus('❌ 선택된 반에 학생이 없습니다.\n학생 관리에서 학생을 반에 배정해주세요.');
        setIsExcelUploading(false);
        return;
      }

      setExcelUploadStatus(`📚 "${bookName}" 단어장 생성 중...\n총 ${dataRows.length}개 단어\n👥 ${studentIds.length}명 학생 발견`);

      let successCount = 0;
      let failCount = 0;

      // 각 학생에게 단어장 생성 및 단어 추가
      for (const studentId of studentIds) {
        try {
          setExcelUploadStatus(`👤 학생 ${successCount + 1}/${studentIds.length} 처리 중...`);

          // 학생의 userData 가져오기
          const userDataRef = doc(db, 'userData', studentId);
          const userDataDoc = await getDoc(userDataRef);

          if (!userDataDoc.exists()) {
            failCount++;
            continue;
          }

          const userData = userDataDoc.data();
          const existingBooks = userData.books || [];
          const existingWords = userData.words || [];

          // 새 단어장 생성 (기존에 같은 이름이 있으면 속성만 업데이트)
          let targetBook = existingBooks.find(b => b.name === bookName);
          let updatedBooks = [...existingBooks];

          if (!targetBook) {
            targetBook = {
              id: Date.now() + Math.random(),
              name: bookName,
              wordCount: 0,
              icon: '📖',
              isExamRange: false,
              category: '교재단어장',
              classId: selectedUploadClassId,
              className: selectedClass.className,
              createdAt: new Date().toISOString()
            };
            updatedBooks.push(targetBook);
          } else {
            // 기존 단어장이 있으면 교재단어장 속성 추가
            targetBook = {
              ...targetBook,
              category: '교재단어장',
              classId: selectedUploadClassId,
              className: selectedClass.className
            };
            updatedBooks = updatedBooks.map(b =>
              b.name === bookName ? targetBook : b
            );
          }

          // 단어 추가 (중복 체크)
          const newWords = [];
          for (const row of dataRows) {
            const english = String(row[0] || '').trim();
            const korean = String(row[1] || '').trim();
            const synonymsRaw = String(row[2] || '').trim();
            const antonymsRaw = String(row[3] || '').trim();
            const definitionRaw = String(row[4] || '').trim();

            if (!english || !korean) continue;

            // 동의어/반의어 배열로 변환 (쉼표로 구분, 빈 문자열 제거, 품사 표시 제거)
            const synonyms = synonymsRaw
              ? synonymsRaw.split(',').map(s => removePartOfSpeechTags(s.trim())).filter(s => s)
              : [];
            const antonyms = antonymsRaw
              ? antonymsRaw.split(',').map(s => removePartOfSpeechTags(s.trim())).filter(s => s)
              : [];
            // 영영풀이에서도 품사 표시 제거
            const definition = removePartOfSpeechTags(definitionRaw);

            // 이미 같은 단어장에 같은 영어 단어가 있는지 확인
            const isDuplicate = existingWords.some(
              w => w.bookId === targetBook.id && w.english.toLowerCase() === english.toLowerCase()
            );

            if (!isDuplicate) {
              newWords.push({
                id: Date.now() + Math.random(),
                bookId: targetBook.id,
                originalBookId: targetBook.id,
                english: english,
                korean: korean,
                example: '',
                pronunciation: '',
                synonyms: synonyms,
                antonyms: antonyms,
                definition: definition,
                mastered: false,
                nextReviewDate: new Date().toISOString(),
                lastReviewDate: null,
                reviewCount: 0,
                correctStreak: 0
              });
            }
          }

          // 단어장의 wordCount 업데이트
          const finalWords = [...existingWords, ...newWords];
          const bookWordCount = finalWords.filter(w => w.bookId === targetBook.id).length;
          updatedBooks = updatedBooks.map(b =>
            b.id === targetBook.id ? { ...b, wordCount: bookWordCount } : b
          );

          // Firestore에 저장 (classId/className도 함께 설정)
          await setDoc(userDataRef, {
            ...userData,
            books: updatedBooks,
            words: finalWords,
            classId: selectedUploadClassId,
            className: selectedClass.className,
            lastUpdated: new Date().toISOString()
          });

          successCount++;
        } catch (error) {
          console.error(`학생 ${studentId} 처리 실패:`, error);
          failCount++;
        }
      }

      setExcelUploadStatus(
        `✅ 완료!\n\n📚 단어장: "${bookName}"\n📝 단어 수: ${dataRows.length}개\n\n✅ 성공: ${successCount}명\n❌ 실패: ${failCount}명`
      );
      setIsExcelUploading(false);
      event.target.value = ''; // 파일 입력 초기화

      // 배포 후 자동으로 해당 반의 단어장 목록 새로고침
      setSelectedClassForBooks(selectedUploadClassId);
      await loadClassBooks(selectedUploadClassId);
    } catch (error) {
      console.error('엑셀 업로드 오류:', error);
      setExcelUploadStatus(`❌ 오류 발생: ${error.message}`);
      setIsExcelUploading(false);
    }
  };

 // DB에서 단어 정보 검색
// eslint-disable-next-line no-unused-vars
const searchWordInDB = async (word) => {
  if (!word.trim() || word.length < 2) return null;

  try {
    const wordDoc = await getDoc(doc(db, 'dictionary', word.toLowerCase()));
    if (wordDoc.exists()) {
      return wordDoc.data();
    }
    return null;
  } catch (error) {
    console.error('DB 검색 오류:', error);
    return null;
  }
};

// 🆕 여기에 추가!
const searchMultipleWordsInDB = async (input) => {
  if (!input.trim()) return [];

  const words = input.split(',')
    .map(word => word.trim())
    .filter(word => word.length >= 2);

  const uniqueWords = [...new Set(words)];

  if (uniqueWords.length === 0) return [];

  try {
    const results = await Promise.allSettled(
      uniqueWords.map(async (word) => {
        try {
          console.log(`🔍 DB 검색 중: "${word.toLowerCase()}"`);
          const wordDoc = await getDoc(doc(db, 'dictionary', word.toLowerCase()));
          console.log(`📄 DB 결과 - 존재: ${wordDoc.exists()}, 데이터:`, wordDoc.exists() ? wordDoc.data() : '없음');

          const pronunciation = await fetchPronunciation(word);

          // 🆕 동의어/반의어 추가!
          const { synonyms, antonyms } = await fetchSynonymsAndAntonyms(word);

          const result = {
            english: word,
            korean: wordDoc.exists() ? wordDoc.data().korean : '',
            pronunciation: wordDoc.exists() ? (wordDoc.data().pronunciation || pronunciation) : pronunciation,
            synonyms: synonyms || [],      // 추가!
            antonyms: antonyms || [],      // 추가!
            exists: wordDoc.exists()
          };
          console.log(`✅ 최종 결과:`, result);
          return result;
        } catch (wordError) {
          console.error(`단어 "${word}" 검색 실패:`, wordError);
          // 실패해도 기본 정보 반환
          return {
            english: word,
            korean: '',
            pronunciation: '',
            synonyms: [],
            antonyms: [],
            exists: false
          };
        }
      })
    );

    // fulfilled된 결과만 추출
    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
  } catch (error) {
    console.error('DB 검색 오류:', error);
    return [];
  }
};
  // 발음기호만 API에서 가져오기
  const fetchPronunciation = async (word) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!response.ok) {
        return '';
      }
      const data = await response.json();
      if (Array.isArray(data) && data[0]?.phonetics) {
        const phonetic = data[0].phonetics.find(p => p.text) || data[0].phonetics[0];
        return phonetic?.text || '';
      }
    } catch (error) {
      // 네트워크 오류나 파싱 오류는 무시하고 빈 문자열 반환
      console.error('발음기호 가져오기 실패:', error);
    }
    return '';
  };


  // 학습 통계 업데이트 함수
  const updateLearningStats = async (isCorrect) => {
    const today = new Date().toISOString().split('T')[0];
    
    setLearningStats(prev => {
      const newStats = { ...prev };
      
      const todayRecord = newStats.studyHistory.find(h => h.date === today);
      if (todayRecord) {
        todayRecord.wordsStudied += 1;
        todayRecord.totalAttempts += 1;
        if (isCorrect) todayRecord.correctAttempts += 1;
        todayRecord.correctRate = todayRecord.correctAttempts / todayRecord.totalAttempts;
      } else {
        newStats.studyHistory.push({
          date: today,
          wordsStudied: 1,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
          correctRate: isCorrect ? 1 : 0
        });
      }
      
      if (prev.lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (prev.lastStudyDate === yesterdayStr) {
          newStats.streak += 1;
        } else if (prev.lastStudyDate === null || prev.lastStudyDate === today) {
          newStats.streak = 1;
        } else {
          newStats.streak = 1;
        }
        
        newStats.lastStudyDate = today;
      }
      
      newStats.todayStudied = newStats.studyHistory
        .filter(h => h.date === today)
        .reduce((sum, h) => sum + h.wordsStudied, 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      newStats.weekStudied = newStats.studyHistory
        .filter(h => h.date >= weekAgoStr)
        .reduce((sum, h) => sum + h.wordsStudied, 0);
      
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const monthAgoStr = monthAgo.toISOString().split('T')[0];
      newStats.monthStudied = newStats.studyHistory
        .filter(h => h.date >= monthAgoStr)
        .reduce((sum, h) => sum + h.wordsStudied, 0);
      
      newStats.totalStudied = newStats.studyHistory
        .reduce((sum, h) => sum + h.wordsStudied, 0);
      
      return newStats;
    });
  };

  // 간격 반복 학습 알고리즘
  const calculateNextReview = (word, isCorrect) => {
    const now = new Date();
    let intervalDays = 1;
    
    if (isCorrect) {
      const streak = (word.correctStreak || 0) + 1;
      intervalDays = Math.min(Math.pow(2, streak), 30);
      
      return {
        ...word,
        correctStreak: streak,
        reviewCount: (word.reviewCount || 0) + 1,
        lastReviewDate: now.toISOString(),
        nextReviewDate: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString()
      };
    } else {
      return {
        ...word,
        correctStreak: 0,
        reviewCount: (word.reviewCount || 0) + 1,
        lastReviewDate: now.toISOString(),
        nextReviewDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      };
    }
  };

  // 객관식 보기 생성
  const generateMultipleChoices = (correctWord, allWords) => {
    const choices = [correctWord];
    const otherWords = allWords.filter(w => w.id !== correctWord.id);
    
    while (choices.length < 4 && otherWords.length > 0) {
      const randomIndex = Math.floor(Math.random() * otherWords.length);
      choices.push(otherWords[randomIndex]);
      otherWords.splice(randomIndex, 1);
    }
    
    return choices.sort(() => Math.random() - 0.5);
  };

  // 철자 맞추기 생성
  const generateSpellingPuzzle = (word) => {
    const letters = word.english.split('');
    return letters.sort(() => Math.random() - 0.5);
  };

  // 출석 체크 함수
  const checkAttendance = async (userId, userName, userClassId, userClassName = '') => {
    try {
      const today = new Date().toISOString().split('T')[0]; // 2025-11-06 형식
      const attendanceRef = doc(db, 'attendance', today);

      // 오늘 출석 데이터 가져오기
      const attendanceDoc = await getDoc(attendanceRef);
      const attendanceData = attendanceDoc.exists() ? attendanceDoc.data() : {};

      // 사용자의 반 ID 확인
      if (!userClassId) return;

      // 해당 반의 출석 데이터 초기화
      if (!attendanceData[userClassId]) {
        attendanceData[userClassId] = {};
      }

      // 이미 출석했는지 확인
      if (!attendanceData[userClassId][userId]) {
        // 출석 기록 추가 - className도 함께 저장
        attendanceData[userClassId][userId] = {
          userName: userName,
          className: userClassName,
          timestamp: new Date().toISOString()
        };

        // Firebase에 저장
        await setDoc(attendanceRef, attendanceData);
        console.log('✅ 출석 체크 완료:', userName, userClassName);
      }
    } catch (error) {
      console.error('❌ 출석 체크 오류:', error);
    }
  };

  // 한국어 받침 체크 및 조사 선택 함수
  const getJosa = (name, josaType) => {
    if (!name) return '';
    const lastChar = name[name.length - 1];
    const code = lastChar.charCodeAt(0);

    // 한글 유니코드 범위: '가'(0xAC00) ~ '힣'(0xD7A3)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const hasBatchim = (code - 0xAC00) % 28 !== 0;

      if (josaType === '이') {
        return hasBatchim ? '이' : '';
      } else if (josaType === '아야') {
        return hasBatchim ? '아' : '야';
      }
    }
    return '';
  };

  // 같은 학년 오늘 출석 현황 로드
  const loadTodayAttendance = async (classId, userClassName = '') => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceRef = doc(db, 'attendance', today);

      const attendanceDoc = await getDoc(attendanceRef);
      if (attendanceDoc.exists()) {
        const attendanceData = attendanceDoc.data();

        // 학년 추출 (예: "고1 복자여고 1반" → "고1")
        const gradeMatch = userClassName.match(/^(고\d|중\d)/);
        const userGrade = gradeMatch ? gradeMatch[1] : '';

        let attendanceList = [];

        // 모든 반을 순회하면서 같은 학년의 학생들 수집
        Object.entries(attendanceData).forEach(([cId, classAttendance]) => {
          Object.entries(classAttendance).forEach(([userId, data]) => {
            // 학년이 같은 학생만 추가
            if (userGrade && data.className) {
              const studentGradeMatch = data.className.match(/^(고\d|중\d)/);
              const studentGrade = studentGradeMatch ? studentGradeMatch[1] : '';

              if (studentGrade === userGrade) {
                attendanceList.push({
                  userId,
                  userName: data.userName,
                  className: data.className,
                  timestamp: data.timestamp
                });
              }
            }
          });
        });

        // 시간순 정렬
        attendanceList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        setTodayAttendance(attendanceList);

        console.log('✅ 학년별 출석 현황 로드:', userGrade, attendanceList.length + '명');
      } else {
        setTodayAttendance([]);
      }
    } catch (error) {
      console.error('❌ 출석 현황 로드 오류:', error);
    }
  };

  // 이번주 출석왕 계산 (월~일)
  const loadWeeklyChampion = async (classId) => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)

      // 이번 주 월요일 계산
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);

      // 이번 주 일요일 계산
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      // 출석 카운트 맵
      const attendanceCount = {};

      // 월요일부터 오늘까지 순회
      const currentDate = new Date(monday);
      while (currentDate <= now && currentDate <= sunday) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const attendanceRef = doc(db, 'attendance', dateStr);

        const attendanceDoc = await getDoc(attendanceRef);
        if (attendanceDoc.exists()) {
          const attendanceData = attendanceDoc.data();
          const classAttendance = attendanceData[classId] || {};

          // 각 학생의 출석 카운트
          Object.values(classAttendance).forEach(student => {
            if (attendanceCount[student.userName]) {
              attendanceCount[student.userName]++;
            } else {
              attendanceCount[student.userName] = 1;
            }
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 가장 많이 출석한 학생 찾기
      let champion = null;
      let maxCount = 0;
      Object.entries(attendanceCount).forEach(([userName, count]) => {
        if (count > maxCount) {
          maxCount = count;
          champion = { userName, count };
        }
      });

      setWeeklyChampion(champion);
      console.log('✅ 이번주 출석왕:', champion);
    } catch (error) {
      console.error('❌ 출석왕 계산 오류:', error);
    }
  };

  // 사용자 데이터 로드
  const loadUserData = async (userId) => {
    try {
      console.log('📂 데이터 로드 시작:', userId);

      // users 컬렉션에서 기본 사용자 정보 가져오기
      let loadedUserName = '';
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        loadedUserName = userData.name || '';
        console.log('✅ users 컬렉션에서 name 로드:', loadedUserName);
      }
      
     const userDataDoc = await getDoc(doc(db, 'userData', userId));
if (userDataDoc.exists()) {
  const data = userDataDoc.data();

  console.log('📥 Firestore에서 불러온 원본 데이터:', {
    booksCount: (data.books || []).length,
    books: data.books,
    wordsCount: (data.words || []).length,
    classId: data.classId,
    userName: data.userName
  });

  // 🆕 마이그레이션: 기존 단어장 업그레이드
  let migratedBooks = data.books || [];

  // 단어장이 없거나 기본 단어장이 1개만 있거나 구버전인 경우
  const needsMigration = migratedBooks.length === 0 || (migratedBooks.length === 1 && migratedBooks[0].name === '기본 단어장');

  if (needsMigration) {
    migratedBooks = [
      { id: 1, name: '이번 시험범위', wordCount: (migratedBooks[0]?.wordCount || 0), isExamRange: true, icon: '🎯' }
    ];

    // 마이그레이션한 경우 즉시 Firestore에 저장
    console.log('💾 마이그레이션된 단어장을 Firestore에 저장합니다...');
    await setDoc(doc(db, 'userData', userId), {
      ...data,
      books: migratedBooks
    });
  } else {
    // 기존 사용자: 불필요한 기본 단어장(id 2, 3, 4, 5) 제거
    console.log('🔍 현재 단어장 목록:', migratedBooks.map(b => ({ id: b.id, name: b.name, category: b.category })));

    const cleanedBooks = migratedBooks.filter(book => {
      // 교재단어장은 모두 유지
      if (book.category === '교재단어장') return true;

      // 나의학습단어장 중에서 bookId 2 (일단 OK)만 제거
      return book.id !== 2;
    });

    console.log('🔍 필터링 후 단어장:', cleanedBooks.map(b => ({ id: b.id, name: b.name, category: b.category })));

    // 변경이 있었으면 저장
    if (cleanedBooks.length !== migratedBooks.length) {
      console.log('🧹 불필요한 단어장 제거:', migratedBooks.length, '→', cleanedBooks.length);
      migratedBooks = cleanedBooks;
      await setDoc(doc(db, 'userData', userId), {
        ...data,
        books: migratedBooks
      });
    } else {
      console.log('⚠️ 제거할 단어장이 없음 (길이 동일:', migratedBooks.length, ')');
    }
  }

  // words 설정 (모든 경우에 적용)
  setWords(data.words || []);

  console.log('📊 마이그레이션 결과:', {
    originalBooksCount: (data.books || []).length,
    finalBooksCount: migratedBooks.length,
    wordsCount: (data.words || []).length,
    wasMigrated: needsMigration
  });

  // 교재단어장 디버깅
  const textbookBooks = migratedBooks.filter(b => b.category === '교재단어장');
  const otherBooks = migratedBooks.filter(b => !b.category || b.category !== '교재단어장');
  console.log('📚 교재단어장:', textbookBooks.length, '개', textbookBooks.map(b => ({ name: b.name, category: b.category })));
  console.log('📖 나의학습단어장:', otherBooks.length, '개', otherBooks.map(b => ({ name: b.name, category: b.category })));

  setBooks(migratedBooks);
        setLearningStats(data.learningStats || {
          todayStudied: 0,
          weekStudied: 0,
          monthStudied: 0,
          totalStudied: 0,
          streak: 0,
          lastStudyDate: null,
          studyHistory: []
        });
        setExamName(data.examName || '');
        setExamDate(data.examDate || '');
        setClassId(data.classId || '');
        setClassName(data.className || '');

        // userName 설정: userData에 있으면 우선, 없으면 users 컬렉션 값 사용
        const finalUserName = data.userName || loadedUserName || '';
        setUserName(finalUserName);
        console.log('📝 최종 userName:', finalUserName, '(userData:', data.userName, ', users:', loadedUserName, ')');

        console.log('✅ 데이터 로드 성공');
        console.log('📖 불러온 데이터:');
        console.log('  - classId:', data.classId);
        console.log('  - className:', data.className);
        console.log('  - userName:', data.userName);
        console.log('  - examName:', data.examName);
        console.log('  - examDate:', data.examDate);

        // 출석 체크 및 같은 학년 출석 현황 로드
        if (data.classId) {
          await checkAttendance(userId, finalUserName || '학생', data.classId, data.className || '');
          await loadTodayAttendance(data.classId, data.className || '');
          await loadWeeklyChampion(data.classId);
          await loadMyClassTests(data.classId); // 내 반 시험 로드
          await loadMyTestResults(userId); // 내 시험 결과 로드
        }
      } else {
        // 새 사용자: 기본 데이터 생성
        console.log('🆕 새 사용자 - 기본 데이터 생성');
        const defaultBooks = [
          { id: 1, name: '이번 시험범위', wordCount: 0, isExamRange: true, icon: '🎯' }
        ];

        // Firestore에 초기 데이터 저장
        console.log('💾 새 사용자 데이터를 Firestore에 저장합니다...');
        await setDoc(doc(db, 'userData', userId), {
          books: defaultBooks,
          words: [],
          learningStats: {
            todayStudied: 0,
            weekStudied: 0,
            monthStudied: 0,
            totalStudied: 0,
            streak: 0,
            lastStudyDate: null,
            studyHistory: []
          },
          examName: '',
          examDate: '',
          classId: '',
          className: '',
          userName: loadedUserName,
          lastUpdated: new Date().toISOString()
        });

        setBooks(defaultBooks);
        setWords([]);
        setUserName(loadedUserName);
      }
    } catch (error) {
      console.error('❌ 데이터 로드 오류:', error);
    }
  };

  // 🆕 모든 학생 목록 로드 (관리자용)
  const loadAllStudents = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const studentsList = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const studentStatsDoc = await getDoc(doc(db, 'userData', userDoc.id));
        
        let stats = null;
        let lastStudyDate = null;
        let daysInactive = 0;
        
        if (studentStatsDoc.exists()) {
          const data = studentStatsDoc.data();
          stats = data.learningStats;
          
          if (stats && stats.lastStudyDate) {
            lastStudyDate = stats.lastStudyDate;
            const today = new Date();
            const lastStudy = new Date(lastStudyDate);
            daysInactive = Math.floor((today - lastStudy) / (1000 * 60 * 60 * 24));
          }
        }
        
        studentsList.push({
          id: userDoc.id,
          name: userData.name,
          email: userData.email,
          stats: stats,
          lastStudyDate: lastStudyDate,
          daysInactive: daysInactive,
          totalWords: studentStatsDoc.exists() ? studentStatsDoc.data().words?.length || 0 : 0,
          classId: studentStatsDoc.exists() ? studentStatsDoc.data().classId || '' : '',
          className: studentStatsDoc.exists() ? studentStatsDoc.data().className || '' : ''
        });
      }
      
      // 최근 활동 순으로 정렬 (오랫동안 안 한 학생이 위로)
      studentsList.sort((a, b) => b.daysInactive - a.daysInactive);
      
      setStudents(studentsList);
      console.log('✅ 학생 목록 로드:', studentsList.length);
    } catch (error) {
      console.error('학생 목록 로드 오류:', error);
    }
  };

  // 모든 반 목록 로드 (관리자용)
  const loadAllClasses = async () => {
    try {
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const classesList = classesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClasses(classesList);
      console.log('✅ 반 목록 로드:', classesList.length);
    } catch (error) {
      console.error('반 목록 로드 오류:', error);
    }
  };

  // 새 반 만들기 (관리자용)
  const createClass = async () => {
    if (!newClassName.trim()) return;

    try {
      const classId = 'class_' + Date.now();
      await setDoc(doc(db, 'classes', classId), {
        className: newClassName,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        students: []
      });

      setNewClassName('');
      setShowClassForm(false);
      await loadAllClasses();
      console.log('✅ 반 생성 완료:', newClassName);
    } catch (error) {
      console.error('반 생성 오류:', error);
    }
  };

  // 시험 로드 함수들
  const loadMyClassTests = async (userClassId) => {
    try {
      const testsSnapshot = await getDocs(collection(db, 'tests'));
      const myTests = testsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(test => test.classId === userClassId && new Date(test.deadline) > new Date());

      if (myTests.length > 0) {
        setCurrentTest(myTests[0]); // 가장 최근 시험 표시
      }
      console.log('✅ 내 반 시험 로드:', myTests.length);
    } catch (error) {
      console.error('시험 로드 오류:', error);
    }
  };

  const loadAllTests = async () => {
    try {
      const testsSnapshot = await getDocs(collection(db, 'tests'));
      const testsList = testsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllTests(testsList);
      console.log('✅ 모든 시험 로드:', testsList.length);
    } catch (error) {
      console.error('모든 시험 로드 오류:', error);
    }
  };

  // 내 시험 결과 로드
  const loadMyTestResults = async (userId) => {
    try {
      const resultsSnapshot = await getDocs(collection(db, 'testResults'));
      const myResults = resultsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(result => result.userId === userId);

      setMyTestResults(myResults);
      console.log('✅ 내 시험 결과 로드:', myResults.length);
    } catch (error) {
      console.error('시험 결과 로드 오류:', error);
    }
  };

  // 학생을 반에 배정 (관리자용)
  const assignStudentToClass = async (studentId, studentName, classId, className) => {
    try {
      // 학생의 userData 업데이트
      const studentDataRef = doc(db, 'userData', studentId);
      const studentDataDoc = await getDoc(studentDataRef);

      let previousClassId = null;

      if (studentDataDoc.exists()) {
        const currentData = studentDataDoc.data();
        previousClassId = currentData.classId; // 이전 반 ID 저장
        await setDoc(studentDataRef, {
          ...currentData,
          classId: classId,
          className: className,
          userName: studentName
        });
      } else {
        // userData가 없으면 생성
        await setDoc(studentDataRef, {
          classId: classId,
          className: className,
          userName: studentName,
          books: [],
          words: [],
          learningStats: {
            todayStudied: 0,
            weekStudied: 0,
            monthStudied: 0,
            totalStudied: 0,
            streak: 0,
            lastStudyDate: null,
            studyHistory: []
          },
          lastUpdated: new Date().toISOString()
        });
      }

      // 이전 반에서 학생 제거
      if (previousClassId && previousClassId !== classId) {
        const prevClassRef = doc(db, 'classes', previousClassId);
        const prevClassDoc = await getDoc(prevClassRef);
        if (prevClassDoc.exists()) {
          const prevClassData = prevClassDoc.data();
          const updatedStudents = (prevClassData.students || []).filter(id => id !== studentId);
          await updateDoc(prevClassRef, { students: updatedStudents });
        }
      }

      // 새 반에 학생 추가
      if (classId) {
        const newClassRef = doc(db, 'classes', classId);
        const newClassDoc = await getDoc(newClassRef);
        if (newClassDoc.exists()) {
          const newClassData = newClassDoc.data();
          const currentStudents = newClassData.students || [];
          if (!currentStudents.includes(studentId)) {
            await updateDoc(newClassRef, { students: [...currentStudents, studentId] });
          }
        }
      }

      console.log('✅ 학생 반 배정 완료:', studentName, '→', className);
      await loadAllStudents();
      await loadAllClasses(); // 반 목록도 새로고침
    } catch (error) {
      console.error('학생 반 배정 오류:', error);
    }
  };

  // 반별 단어장 목록 조회 (관리자용)
  const loadClassBooks = async (classId) => {
    if (!classId) {
      setClassBooks([]);
      return;
    }

    setIsLoadingClassBooks(true);
    try {
      const selectedClass = classes.find(c => c.id === classId);
      if (!selectedClass) {
        setClassBooks([]);
        setIsLoadingClassBooks(false);
        return;
      }

      // classes.students 배열과 userData.classId 모두에서 학생 찾기
      let studentIds = [...(selectedClass.students || [])];
      console.log('📋 classes.students에서 찾은 학생:', studentIds.length);

      // userData에서 해당 반에 속한 학생들도 찾기
      const userDataSnapshot = await getDocs(collection(db, 'userData'));
      userDataSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.classId === classId && !studentIds.includes(docSnap.id)) {
          studentIds.push(docSnap.id);
          console.log('📌 userData.classId로 추가된 학생:', docSnap.id);
        }
      });

      console.log('👥 총 발견된 학생 수:', studentIds.length);

      if (studentIds.length === 0) {
        console.log('❌ 학생이 없어서 조회 종료');
        setClassBooks([]);
        setIsLoadingClassBooks(false);
        return;
      }

      // 모든 학생의 교재단어장을 집계
      const bookMap = new Map(); // bookName -> { book, studentCount }

      for (const studentId of studentIds) {
        try {
          const userDataRef = doc(db, 'userData', studentId);
          const userDataDoc = await getDoc(userDataRef);

          if (userDataDoc.exists()) {
            const userData = userDataDoc.data();
            const books = userData.books || [];
            console.log(`📚 학생 ${studentId}의 전체 단어장:`, books.length, '개');

            // 교재단어장만 필터링
            const textbookBooks = books.filter(b =>
              b.category === '교재단어장' || b.classId
            );
            console.log(`📖 학생 ${studentId}의 교재단어장:`, textbookBooks.length, '개', textbookBooks.map(b => b.name));

            for (const book of textbookBooks) {
              if (!bookMap.has(book.name)) {
                bookMap.set(book.name, {
                  ...book,
                  studentCount: 1,
                  totalStudents: studentIds.length
                });
              } else {
                const existing = bookMap.get(book.name);
                existing.studentCount++;
              }
            }
          } else {
            console.log(`⚠️ 학생 ${studentId}의 userData가 존재하지 않음`);
          }
        } catch (err) {
          console.error(`학생 ${studentId} 데이터 로드 실패:`, err);
        }
      }

      const aggregatedBooks = Array.from(bookMap.values()).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      console.log('✅ 최종 집계된 단어장:', aggregatedBooks.length, '개');
      setClassBooks(aggregatedBooks);
    } catch (error) {
      console.error('반별 단어장 로드 오류:', error);
      setClassBooks([]);
    }
    setIsLoadingClassBooks(false);
  };

  // 반별 단어장 삭제 (해당 반의 모든 학생에게서 삭제)
  const deleteClassBook = async (bookName, classId) => {
    if (!window.confirm(`"${bookName}" 단어장을 해당 반의 모든 학생에게서 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const selectedClass = classes.find(c => c.id === classId);
      if (!selectedClass) {
        alert('반 정보를 찾을 수 없습니다.');
        return;
      }

      // classes.students 배열과 userData.classId 모두에서 학생 찾기
      let studentIds = [...(selectedClass.students || [])];

      // userData에서 해당 반에 속한 학생들도 찾기
      const userDataSnapshot = await getDocs(collection(db, 'userData'));
      userDataSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.classId === classId && !studentIds.includes(doc.id)) {
          studentIds.push(doc.id);
        }
      });

      let successCount = 0;
      let failCount = 0;

      for (const studentId of studentIds) {
        try {
          const userDataRef = doc(db, 'userData', studentId);
          const userDataDoc = await getDoc(userDataRef);

          if (userDataDoc.exists()) {
            const userData = userDataDoc.data();
            const existingBooks = userData.books || [];
            const existingWords = userData.words || [];

            // 해당 단어장 찾기
            const targetBook = existingBooks.find(b => b.name === bookName);
            if (targetBook) {
              // 단어장과 해당 단어장의 단어들 삭제
              const updatedBooks = existingBooks.filter(b => b.name !== bookName);
              const updatedWords = existingWords.filter(w => w.bookId !== targetBook.id);

              await setDoc(userDataRef, {
                ...userData,
                books: updatedBooks,
                words: updatedWords,
                lastUpdated: new Date().toISOString()
              });
              successCount++;
            }
          }
        } catch (error) {
          console.error(`학생 ${studentId} 단어장 삭제 실패:`, error);
          failCount++;
        }
      }

      alert(`✅ 삭제 완료!\n\n성공: ${successCount}명\n실패: ${failCount}명`);
      // 목록 새로고침
      await loadClassBooks(classId);
    } catch (error) {
      console.error('반별 단어장 삭제 오류:', error);
      alert('단어장 삭제 중 오류가 발생했습니다.');
    }
  };

  // 모든 단어 로드 (관리자용)
  const loadAllWords = async () => {
    try {
      const wordsSnapshot = await getDocs(collection(db, 'dictionary'));
      const wordsList = wordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllWords(wordsList);
      console.log('✅ 단어 로드 완료:', wordsList.length, '개');
    } catch (error) {
      console.error('단어 로드 오류:', error);
    }
  };

  // 단어 수정
  const updateWord = async (wordId, updatedData) => {
    try {
      // 품사 표시 제거
      const cleanedData = { ...updatedData };
      if (cleanedData.definition) {
        cleanedData.definition = removePartOfSpeechTags(cleanedData.definition);
      }
      if (cleanedData.synonyms) {
        cleanedData.synonyms = removePartOfSpeechTags(cleanedData.synonyms);
      }
      if (cleanedData.antonyms) {
        cleanedData.antonyms = removePartOfSpeechTags(cleanedData.antonyms);
      }

      const wordRef = doc(db, 'dictionary', wordId);
      await updateDoc(wordRef, {
        ...cleanedData,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ 단어 수정 완료:', wordId);
      await loadAllWords();
      setEditingWord(null);
    } catch (error) {
      console.error('단어 수정 오류:', error);
      alert('단어 수정에 실패했습니다.');
    }
  };

  // 단어 삭제 (관리자용 - DB에서 완전 삭제)
  const deleteWordFromDB = async (wordId, wordEnglish) => {
    if (!confirm(`"${wordEnglish}" 단어를 삭제하시겠습니까?`)) return;

    try {
      const wordRef = doc(db, 'dictionary', wordId);
      await deleteDoc(wordRef);
      console.log('✅ 단어 삭제 완료:', wordId);
      await loadAllWords();
    } catch (error) {
      console.error('단어 삭제 오류:', error);
      alert('단어 삭제에 실패했습니다.');
    }
  };

  // 선택된 단어 일괄 삭제
  const bulkDeleteWords = async () => {
    if (selectedWordIds.length === 0) {
      alert('삭제할 단어를 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedWordIds.length}개의 단어를 삭제하시겠습니까?`)) return;

    try {
      let successCount = 0;
      let failCount = 0;

      for (const wordId of selectedWordIds) {
        try {
          const wordRef = doc(db, 'dictionary', wordId);
          await deleteDoc(wordRef);
          successCount++;
        } catch (error) {
          console.error('단어 삭제 오류:', wordId, error);
          failCount++;
        }
      }

      alert(`${successCount}개 삭제 완료${failCount > 0 ? `, ${failCount}개 실패` : ''}`);
      setSelectedWordIds([]);
      await loadAllWords();
    } catch (error) {
      console.error('일괄 삭제 오류:', error);
      alert('일괄 삭제에 실패했습니다.');
    }
  };

  // 체크박스 토글
  const toggleWordSelection = (wordId) => {
    setSelectedWordIds(prev =>
      prev.includes(wordId)
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  };

  // 전체 선택/해제
  const toggleAllWords = () => {
    if (selectedWordIds.length === filteredWords.length) {
      setSelectedWordIds([]);
    } else {
      setSelectedWordIds(filteredWords.map(w => w.id));
    }
  };

  // 사용자 데이터 저장
  const saveUserData = useCallback(async () => {
    if (!currentUser) {
      console.log('⚠️ currentUser 없음 - 저장 중단');
      return;
    }

    try {
      // 기존 데이터를 먼저 가져와서 classId/className 보존
      const userDataRef = doc(db, 'userData', currentUser.uid);
      const existingDoc = await getDoc(userDataRef);
      const existingData = existingDoc.exists() ? existingDoc.data() : {};

      // 저장하기 전에 모든 단어에서 품사 표시 제거
      const cleanedWords = words.map(word => ({
        ...word,
        definition: word.definition ? removePartOfSpeechTags(word.definition) : word.definition,
        synonyms: Array.isArray(word.synonyms)
          ? word.synonyms.map(s => removePartOfSpeechTags(s)).filter(s => s)
          : word.synonyms,
        antonyms: Array.isArray(word.antonyms)
          ? word.antonyms.map(a => removePartOfSpeechTags(a)).filter(a => a)
          : word.antonyms
      }));

      const dataToSave = {
        books: books,
        words: cleanedWords,
        learningStats: learningStats,
        examName: examName,
        examDate: examDate,
        // classId와 className은 항상 기존 DB 값 우선 (관리자가 배정한 값 보호)
        classId: existingData.classId !== undefined ? existingData.classId : classId,
        className: existingData.className !== undefined ? existingData.className : className,
        userName: userName || existingData.userName,
        lastUpdated: new Date().toISOString()
      };
      console.log('💾 데이터 저장 중:', currentUser.email);
      console.log('  - 단어장 수:', dataToSave.books.length);
      console.log('  - 단어 수:', dataToSave.words.length);
      console.log('  - classId:', dataToSave.classId);
      console.log('  - className:', dataToSave.className);
      console.log('  - userName:', dataToSave.userName);
      console.log('  - examName:', dataToSave.examName);
      console.log('  - examDate:', dataToSave.examDate);
      await setDoc(userDataRef, dataToSave);
      console.log('✅ 데이터 저장 성공!');
    } catch (error) {
      console.error('❌ 데이터 저장 오류:', error);
    }
  }, [currentUser, books, words, learningStats, examName, examDate, classId, className, userName]);

  // 로그인 상태 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);  // 로드 시작 전에 loading=true 설정
        setCurrentUser(user);
        setIsLoggedIn(true);
        await loadUserData(user.uid);  // 데이터 로드가 끝날 때까지 기다림
        setLoading(false);  // 로드 완료 후에 false로!
      } else {
        // 로그아웃 시 모든 state 초기화
        setLoading(true);  // 다음 로그인을 위해 loading=true로 설정
        setCurrentUser(null);
        setIsLoggedIn(false);
        setCurrentView('home');
        setBooks([]);
        setWords([]);
        setLearningStats({
          todayStudied: 0,
          weekStudied: 0,
          monthStudied: 0,
          totalStudied: 0,
          streak: 0,
          lastStudyDate: null,
          studyHistory: []
        });
        setExamName('');
        setExamDate('');
        setClassId('');
        setClassName('');
        setUserName('');
        setTodayAttendance([]);
        setWeeklyChampion(null);
        setSelectedBook(null);
        setCurrentTest(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);
  
  // 데이터 자동 저장
  useEffect(() => {
    if (isLoggedIn && currentUser && !loading) {
      saveUserData();
    }
  }, [books, words, learningStats, examName, examDate, classId, className, userName, isLoggedIn, currentUser, loading, saveUserData]);

  // 페이지를 떠날 때 데이터 저장
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isLoggedIn && currentUser) {
        saveUserData();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoggedIn, currentUser, books, words, learningStats, examName, examDate, classId, className, userName, saveUserData]);

  // 관리자 페이지 진입 시 데이터 로드
  useEffect(() => {
    if (isAdmin) {
      loadAllClasses();
      loadAllStudents();
      loadAllTests();
    }
  }, [isAdmin]);

  // 회원가입
  const handleSignup = async () => {
    setAuthError('');

    if (!signupForm.email || !signupForm.name || !signupForm.password || !signupForm.confirmPassword) {
      setAuthError('모든 항목을 입력해주세요');
      return;
    }

    if (!/^\d{6}$/.test(signupForm.password)) {
      setAuthError('비밀번호는 6자리 숫자여야 합니다');
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      setAuthError('비밀번호가 일치하지 않습니다');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signupForm.email, signupForm.password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: signupForm.name,
        email: signupForm.email,
        createdAt: new Date().toISOString()
      });
      setSignupForm({ email: '', name: '', password: '', confirmPassword: '' });
    } catch (error) {
      console.error('회원가입 오류:', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('이미 가입된 이메일입니다');
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('유효하지 않은 이메일 형식입니다');
      } else {
        setAuthError(`회원가입 중 오류가 발생했습니다: ${error.message}`);
      }
    }
  };

  // 로그인
  const handleLogin = async () => {
    setAuthError('');

    if (!loginForm.email || !loginForm.password) {
      setAuthError('이메일과 비밀번호를 입력해주세요');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      setLoginForm({ email: '', password: '' });
    } catch (error) {
      console.error('로그인 오류:', error);
      if (error.code === 'auth/user-not-found') {
        setAuthError('가입되지 않은 이메일입니다');
      } else if (error.code === 'auth/wrong-password') {
        setAuthError('비밀번호가 일치하지 않습니다');
      } else {
        setAuthError('로그인 중 오류가 발생했습니다');
      }
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await saveUserData();
      await signOut(auth);
      // state 초기화는 onAuthStateChanged에서 처리됨
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  // 단어장 추가
  const addBook = () => {
    if (newBookName.trim()) {
      const newBook = {
        id: Date.now(),
        name: newBookName,
        wordCount: 0
      };
      setBooks([...books, newBook]);
      setNewBookName('');
      setShowBookInput(false);
    }
  };

  // 단어장 삭제
  const deleteBook = (bookId) => {
    if (window.confirm('이 단어장을 삭제하시겠습니까?')) {
      setBooks(books.filter(b => b.id !== bookId));
      setWords(words.filter(w => w.bookId !== bookId));
      if (selectedBook?.id === bookId) {
        setSelectedBook(null);
        setCurrentView('home');
      }
    }
  };

  // 시험범위 표시 토글
  const toggleExamRange = (bookId) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    // bookId 1은 이미 시험범위이므로 토글 불가
    if (bookId === 1) {
      alert('이미 시험범위 단어장입니다!');
      return;
    }

    const newIsExamRange = !book.isExamRange;

    // true로 변경시: 해당 단어장의 모든 단어를 시험범위(bookId 1)로 복사
    if (newIsExamRange) {
      const wordsFromBook = words.filter(w => w.bookId === bookId && !w.mastered);

      if (wordsFromBook.length === 0) {
        alert('복사할 단어가 없습니다.');
        return;
      }

      // 단어 복사 (새로운 ID로, copiedFrom 필드 추가)
      const copiedWords = wordsFromBook.map(w => ({
        ...w,
        id: Date.now() + Math.random(),
        bookId: 1,
        copiedFrom: bookId,  // 어느 단어장에서 복사됐는지 기록
        originalBookId: w.originalBookId || w.bookId  // 원래 단어장 정보 유지
      }));

      setWords([...words, ...copiedWords]);

      // 시험범위 단어장의 wordCount 증가
      setBooks(books.map(b =>
        b.id === 1
          ? { ...b, wordCount: b.wordCount + copiedWords.length }
          : b.id === bookId
          ? { ...b, isExamRange: newIsExamRange }
          : b
      ));

      alert(`${copiedWords.length}개의 단어가 시험범위로 복사되었습니다!`);
    } else {
      // false로 변경시: 해당 단어장에서 복사된 단어들을 시험범위에서 제거
      const copiedWordsFromThisBook = words.filter(w => w.bookId === 1 && w.copiedFrom === bookId);

      if (copiedWordsFromThisBook.length > 0) {
        // copiedFrom이 bookId인 단어들 제거
        setWords(words.filter(w => !(w.bookId === 1 && w.copiedFrom === bookId)));

        // 시험범위 단어장의 wordCount 감소
        setBooks(books.map(b =>
          b.id === 1
            ? { ...b, wordCount: Math.max(0, b.wordCount - copiedWordsFromThisBook.length) }
            : b.id === bookId
            ? { ...b, isExamRange: newIsExamRange }
            : b
        ));

        alert(`${copiedWordsFromThisBook.length}개의 단어가 시험범위에서 제거되었습니다.`);
      } else {
        setBooks(books.map(b =>
          b.id === bookId ? { ...b, isExamRange: newIsExamRange } : b
        ));
        alert('시험범위 표시가 해제되었습니다.');
      }
    }
  };

  // 단어장 선택
  const selectBook = (book) => {
    setSelectedBook(book);
    setCurrentView('list');
  };

 // 단어 추가
const addWord = async () => {
  if (!newWord.english.trim()) return;

  if (!selectedBook) {
    alert('단어장을 먼저 선택해주세요.');
    return;
  }

  const inputWords = newWord.english.split(',')
    .map(w => w.trim())
    .filter(w => w.length >= 2);

  if (inputWords.length === 0) return;

  setIsLoadingTranslation(true);

 try {
    const wordResults = await searchMultipleWordsInDB(newWord.english);

    if (!wordResults || wordResults.length === 0) {
      alert('단어 정보를 찾을 수 없습니다.');
      return;
    }

    const newWords = wordResults.map(wordInfo => ({
      id: Date.now() + Math.random(),
      bookId: selectedBook.id,
      originalBookId: selectedBook.id,  // 원래 단어장 기억
      english: wordInfo.english,
      korean: wordInfo.korean || '',
      example: '',
      pronunciation: wordInfo.pronunciation || '',
      synonyms: wordInfo.synonyms || [],        // 🆕 추가!
      antonyms: wordInfo.antonyms || [],        // 🆕 추가!
      mastered: false,
      nextReviewDate: new Date().toISOString(),
      lastReviewDate: null,
      reviewCount: 0,
      correctStreak: 0
    }));
    
    setWords([...words, ...newWords]);
    setNewWord({ english: '', korean: '', example: '', pronunciation: '' });
    setShowAddForm(false);
    
    setBooks(books.map(b => 
      b.id === selectedBook.id 
        ? { ...b, wordCount: b.wordCount + newWords.length }
        : b
    ));
    
    alert(`✅ ${newWords.length}개의 단어가 추가되었습니다!`);
    
  } catch (error) {
    console.error('단어 추가 오류:', error);
    alert('단어 추가 중 오류가 발생했습니다.');
  } finally {
    setIsLoadingTranslation(false);
  }
};

// 동의어/반의어 클릭 시 단어 추가
const addWordFromClick = async (clickedWord) => {
  if (!selectedBook) {
    alert('단어장을 먼저 선택해주세요.');
    return;
  }

  // 이미 단어장에 있는지 확인
  const exists = words.some(w => w.english.toLowerCase() === clickedWord.toLowerCase());
  if (exists) {
    alert('이미 단어장에 있는 단어입니다!');
    return;
  }

  setIsLoadingTranslation(true);

  try {
    const wordResults = await searchMultipleWordsInDB(clickedWord);

    if (!wordResults || wordResults.length === 0) {
      alert('단어 정보를 찾을 수 없습니다.');
      return;
    }

    const wordInfo = wordResults[0];
    const newWordObj = {
      id: Date.now() + Math.random(),
      bookId: selectedBook.id,
      originalBookId: selectedBook.id,  // 원래 단어장 기억
      english: wordInfo.english,
      korean: wordInfo.korean || '',
      example: '',
      pronunciation: wordInfo.pronunciation || '',
      synonyms: wordInfo.synonyms || [],
      antonyms: wordInfo.antonyms || [],
      mastered: false,
      nextReviewDate: new Date().toISOString(),
      lastReviewDate: null,
      reviewCount: 0,
      correctStreak: 0
    };
    
    setWords([...words, newWordObj]);
    
    setBooks(books.map(b => 
      b.id === selectedBook.id 
        ? { ...b, wordCount: b.wordCount + 1 }
        : b
    ));
    
    alert(`✅ "${clickedWord}" 단어가 추가되었습니다!`);
    
  } catch (error) {
    console.error('단어 추가 오류:', error);
    alert('단어 추가 중 오류가 발생했습니다.');
  } finally {
    setIsLoadingTranslation(false);
  }
};

  // 단어 삭제
  const deleteWord = (wordId) => {
    if (window.confirm('이 단어를 삭제하시겠습니까?')) {
      setWords(words.filter(w => w.id !== wordId));
      setBooks(books.map(b => 
        b.id === selectedBook.id 
          ? { ...b, wordCount: Math.max(0, b.wordCount - 1) }
          : b
      ));
    }
  };

  // 암기 완료 토글 (다시 외우러 가기)
  const toggleMastered = (wordId) => {
    const word = words.find(w => w.id === wordId);
    if (!word) return;

    // 원래 단어장으로 복원 (originalBookId가 없으면 bookId 사용)
    const targetBookId = word.originalBookId || word.bookId;

    // mastered를 false로 바꾸고 원래 단어장으로 이동
    setWords(words.map(w =>
      w.id === wordId
        ? { ...w, mastered: false, bookId: targetBookId }
        : w
    ));

    // 원래 단어장의 wordCount 증가
    setBooks(books.map(b =>
      b.id === targetBookId
        ? { ...b, wordCount: b.wordCount + 1 }
        : b
    ));
  };

  // 암기완료 버튼 - 암기완료 처리
  const markAsMastered = (wordId) => {
    const word = words.find(w => w.id === wordId);
    if (!word) return;

    // 현재 단어장에서 wordCount 감소
    setBooks(books.map(b =>
      b.id === word.bookId
        ? { ...b, wordCount: Math.max(0, b.wordCount - 1) }
        : b
    ));

    // mastered = true로 설정
    setWords(words.map(w =>
      w.id === wordId ? { ...w, mastered: true } : w
    ));
  };

  // 오답노트 추가/제거
  const toggleWrongNote = (wordId) => {
    setWords(words.map(w =>
      w.id === wordId ? { ...w, wrongNote: !w.wrongNote } : w
    ));
  };

  // 음성 출력
  const speakWord = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9; // 조금 천천히

      // 사용 가능한 음성 목록에서 영어 음성 찾기
      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(voice =>
          voice.lang.startsWith('en-') ||
          voice.lang === 'en-US' ||
          voice.lang === 'en-GB'
        );

        if (englishVoice) {
          utterance.voice = englishVoice;
          console.log('✅ 영어 음성 사용:', englishVoice.name);
        } else {
          console.log('⚠️ 영어 음성을 찾을 수 없습니다. 기본 음성 사용.');
        }

        window.speechSynthesis.speak(utterance);
      };

      // 음성 목록이 아직 로드되지 않았을 경우 대비
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoiceAndSpeak();
      } else {
        window.speechSynthesis.addEventListener('voiceschanged', setVoiceAndSpeak, { once: true });
      }
    }
  };

  // 플래시카드 시작
  const startFlashcard = () => {
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setCurrentView('flashcard');
  };

  // 퀴즈 시작
  const startQuiz = (mode = 'typing', direction = 'en-ko') => {
    // 단어 순서를 랜덤으로 섞기
    const shuffledWords = [...currentBookWords].sort(() => Math.random() - 0.5);
    setQuizWords(shuffledWords);

    setQuizMode(mode);
    setQuizDirection(direction);
    setCurrentCardIndex(0);
    setQuizAnswer('');
    setQuizResult(null);
    setScore({ correct: 0, total: 0 });

    if (mode === 'multiple') {
      setMultipleChoices(generateMultipleChoices(shuffledWords[0], shuffledWords));
    } else if (mode === 'spelling') {
      setSpellingInput(generateSpellingPuzzle(shuffledWords[0]));
      setSelectedLetters([]); // 선택된 철자 초기화
    }

    setCurrentView('quiz');
  };

  // 다음 카드
  const nextCard = () => {
    if (currentCardIndex < currentBookWords.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
    } else {
      setCurrentCardIndex(0);
      setShowAnswer(false);
    }
  };

  // 이전 카드
  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setShowAnswer(false);
    } else {
      setCurrentCardIndex(currentBookWords.length - 1);
      setShowAnswer(false);
    }
  };

  // 퀴즈 정답 확인
  const checkAnswer = () => {
    const currentWord = quizWords[currentCardIndex];
    let isCorrect = false;

    if (quizMode === 'typing' || quizMode === 'listening') {
      const correctAnswer = quizDirection === 'en-ko' ? currentWord.korean : currentWord.english;

      // 쉼표로 구분된 여러 뜻 중 하나만 맞춰도 정답 처리
      const correctAnswers = correctAnswer.split(',').map(ans => ans.trim().toLowerCase());
      const userAnswer = quizAnswer.trim().toLowerCase();
      isCorrect = correctAnswers.some(ans => ans === userAnswer);
    } else if (quizMode === 'multiple') {
      const correctAnswer = quizDirection === 'en-ko' ? currentWord.korean : currentWord.english;
      isCorrect = quizAnswer === correctAnswer;
    } else if (quizMode === 'spelling') {
      // 선택된 철자로 만든 단어가 정답과 일치하는지 확인
      isCorrect = selectedLetters.join('') === currentWord.english;
    }

    setQuizResult(isCorrect);
    setScore({
      correct: score.correct + (isCorrect ? 1 : 0),
      total: score.total + 1
    });

    const updatedWord = calculateNextReview(currentWord, isCorrect);
    setWords(words.map(w => w.id === currentWord.id ? updatedWord : w));

    updateLearningStats(isCorrect);
  };

  // 다음 퀴즈
  const nextQuiz = async () => {
    if (currentCardIndex < quizWords.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setQuizAnswer('');
      setQuizResult(null);

      if (quizMode === 'multiple') {
        setMultipleChoices(generateMultipleChoices(quizWords[currentCardIndex + 1], quizWords));
      } else if (quizMode === 'spelling') {
        setSpellingInput(generateSpellingPuzzle(quizWords[currentCardIndex + 1]));
        setSelectedLetters([]); // 선택된 철자 초기화
      }
    } else {
      const finalCorrect = score.correct + (quizResult ? 1 : 0);
      const finalTotal = score.total + 1;
      const percentage = Math.round((finalCorrect / finalTotal) * 100);

      // 결과를 저장하고 결과 화면으로 전환
      const results = {
        correct: finalCorrect,
        total: finalTotal,
        percentage: percentage
      };
      setQuizResults(results);

      // 시험 결과를 Firestore에 저장 (currentTest가 있는 경우)
      if (currentTest && user) {
        try {
          const resultData = {
            userId: user.uid,
            testId: currentTest.id,
            testTitle: currentTest.title,
            score: percentage,
            correct: finalCorrect,
            total: finalTotal,
            passed: percentage >= 90,
            completedAt: new Date().toISOString()
          };

          await addDoc(collection(db, 'testResults'), resultData);
          await loadMyTestResults(user.uid); // 결과 목록 새로고침
          console.log('✅ 시험 결과 저장 완료:', percentage + '%');
        } catch (error) {
          console.error('시험 결과 저장 오류:', error);
        }
      }

      setCurrentView('quizResults');
    }
  };

  // 현재 단어장의 단어들만 필터링 (암기완료된 단어 제외)
  const currentBookWords = words.filter(w => w.bookId === selectedBook?.id && !w.mastered);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #f5f9f3, #e8f3e5, #f0f5ee)', width: '100vw', minHeight: '100vh', height: '100vh' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
          @font-face {
            font-family: 'Locus_sangsang';
            src: url('/locus_sangsang.ttf') format('truetype');
          }
          body { margin: 0 !important; padding: 0 !important; font-family: 'Locus_sangsang', sans-serif; }
          * { font-family: 'Locus_sangsang', sans-serif; }
        `}</style>
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: '#172f0b' }}>로딩 중...</div>
        </div>
      </div>
    );
  }

 // 로그인 화면 - 귀여운 파스텔톤
if (!isLoggedIn) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0px",
        background: "linear-gradient(135deg, #fce7f3, #f3e8ff, #dbeafe, #e0f2fe)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          overflow: hidden;
          height: 100%;
          width: 100%;
        }
        body, input, button, textarea, select {
          font-family: 'Locus_sangsang', sans-serif;
        }
      `}</style>

      <div style={{
        width: '100%',
        padding: '0 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxHeight: '100vh',
        overflow: 'hidden'
      }}>
        {/* 로고 및 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <img
              src="/66.png"
              alt="Mine Voca Logo"
              style={{
                width: "90px",
                height: "90px",
                objectFit: "contain",
                filter: 'drop-shadow(0 4px 16px rgba(236, 72, 153, 0.2))'
              }}
            />
          </div>
          <h1 style={{
            fontFamily: "'Gamja Flower', cursive",
            fontWeight: 700,
            fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
            margin: 0,
            marginBottom: '6px'
          }}>
            <span style={{
              fontFamily: "'Gamja Flower', cursive",
              letterSpacing: '-0.05em',
              marginRight: '0.1em',
              background: 'linear-gradient(135deg, #ec4899, #f472b6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>MINE</span>
            <span style={{
              fontFamily: "'Gamja Flower', cursive",
              letterSpacing: '-0.05em',
              background: 'linear-gradient(135deg, #a855f7, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>VOCA</span>
          </h1>
          <p style={{
            fontSize: '0.95rem',
            color: '#9ca3af',
            margin: 0,
            fontWeight: '500'
          }}>
            세상의 모든 단어를 우리 것으로 🌟
          </p>
        </div>

        {/* 로그인/회원가입 카드 */}
        <div style={{
          maxWidth: '420px',
          width: '100%',
          margin: '0 auto',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '28px',
          boxShadow: '0 10px 40px rgba(236, 72, 153, 0.15)',
          border: '2px solid rgba(236, 72, 153, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #fce7f3, #f3e8ff)',
            padding: '5px',
            borderRadius: '14px'
          }}>
            <button
              onClick={() => {
                setAuthView('login');
                setAuthError('');
              }}
              style={{
                flex: 1,
                padding: '10px',
                background: authView === 'login' ? 'white' : 'transparent',
                color: authView === 'login' ? '#ec4899' : '#9ca3af',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: authView === 'login' ? '0 2px 8px rgba(236, 72, 153, 0.15)' : 'none'
              }}
            >
              로그인
            </button>
            <button
              onClick={() => {
                setAuthView('signup');
                setAuthError('');
              }}
              style={{
                flex: 1,
                padding: '10px',
                background: authView === 'signup' ? 'white' : 'transparent',
                color: authView === 'signup' ? '#a855f7' : '#9ca3af',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: authView === 'signup' ? '0 2px 8px rgba(168, 85, 247, 0.15)' : 'none'
              }}
            >
              회원가입
            </button>
          </div>

          {authError && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#dc2626',
              fontSize: '0.85rem'
            }}>
              {authError}
            </div>
          )}

          {authView === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <input
                  type="email"
                  placeholder="이메일 주소"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #fce7f3',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                    background: 'white',
                    color: '#333'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#f9a8d4'}
                  onBlur={(e) => e.target.style.borderColor = '#fce7f3'}
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="비밀번호 (6자리)"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #fce7f3',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                    background: 'white',
                    color: '#333'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#f9a8d4'}
                  onBlur={(e) => e.target.style.borderColor = '#fce7f3'}
                  maxLength={6}
                />
              </div>
              <button
                onClick={handleLogin}
                style={{
                  width: '100%',
                  padding: '15px',
                  background: 'linear-gradient(135deg, #ec4899, #f472b6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(236, 72, 153, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.3)';
                }}
              >
                시작하기 💖
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <input
                  type="email"
                  placeholder="이메일 주소"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #f3e8ff',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                    background: 'white',
                    color: '#333'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#d8b4fe'}
                  onBlur={(e) => e.target.style.borderColor = '#f3e8ff'}
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="이름"
                  value={signupForm.name}
                  onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #f3e8ff',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                    background: 'white',
                    color: '#333'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#d8b4fe'}
                  onBlur={(e) => e.target.style.borderColor = '#f3e8ff'}
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="비밀번호 (6자리 숫자)"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #f3e8ff',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                    background: 'white',
                    color: '#333'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#d8b4fe'}
                  onBlur={(e) => e.target.style.borderColor = '#f3e8ff'}
                  maxLength={6}
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  value={signupForm.confirmPassword}
                  onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleSignup()}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #f3e8ff',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border 0.2s',
                    background: 'white',
                    color: '#333'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#d8b4fe'}
                  onBlur={(e) => e.target.style.borderColor = '#f3e8ff'}
                  maxLength={6}
                />
              </div>
              <button
                onClick={handleSignup}
                style={{
                  width: '100%',
                  padding: '15px',
                  background: 'linear-gradient(135deg, #a855f7, #c084fc)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)';
                }}
              >
                가입하고 시작하기 ✨
              </button>
            </div>
          )}
        </div>

        {/* 하단 정보 */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '16px',
          fontSize: '0.8rem',
          color: '#9ca3af'
        }}>
          <p style={{ margin: 0 }}>
            BY 인영쌤🎃
          </p>
        </div>
      </div>
    </div>
  );
}

// 학습 통계 화면
if (currentView === 'stats') {
  const recentHistory = learningStats.studyHistory.slice(-7).reverse();
  const avgCorrectRate = recentHistory.length > 0
    ? Math.round((recentHistory.reduce((sum, h) => sum + h.correctRate, 0) / recentHistory.length) * 100)
    : 0;

  return (
    <div style={{ 
      background: 'linear-gradient(to bottom right, #f5f9f3, #e8f3e5, #f0f5ee)', 
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto', padding: '12px', boxSizing: 'border-box' }}>
        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => setCurrentView('home')}
            style={{
              background: 'white',
              border: '2px solid #e8f3e5',
              color: '#172f0b',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← 홈으로
          </button>
          <h1 style={{ 
            fontSize: '1.2rem', 
            fontWeight: '700', 
            color: '#172f0b',
            margin: 0
          }}>
            📊 학습 통계
          </h1>
          <div style={{ width: '60px' }}></div>
        </div>

        {/* 주요 통계 카드들 */}
        <div style={{ 
          display: 'flex',
          gap: '8px',
          marginBottom: '14px',
          overflowX: 'auto'
        }}>
          {/* 오늘 학습 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            minWidth: '110px',
            flex: '1'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #167c4c, #4fc3ac)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Calendar size={16} color="white" />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center' }}>오늘</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#172f0b' }}>
                {learningStats.todayStudied}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center' }}>개 단어 학습</div>
            </div>
          </div>

          {/* 연속 학습일 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            minWidth: '110px',
            flex: '1'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Star size={16} color="white" />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center' }}>연속</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#172f0b' }}>
                {learningStats.streak}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center' }}>일 연속 🔥</div>
            </div>
          </div>

          {/* 주간 학습 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            minWidth: '110px',
            flex: '1'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #a8e063, #56ab2f)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp size={16} color="white" />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center' }}>이번 주</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#172f0b' }}>
                {learningStats.weekStudied}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center' }}>개 단어 학습</div>
            </div>
          </div>

          {/* 월간 학습 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            minWidth: '110px',
            flex: '1'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #172f0b, #2d5a1a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BarChart3 size={16} color="white" />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center' }}>이번 달</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#172f0b' }}>
                {learningStats.monthStudied}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center' }}>개 단어 학습</div>
            </div>
          </div>
        </div>

        {/* 최근 7일 학습 기록 */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          padding: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          marginBottom: '14px'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#172f0b', marginBottom: '12px' }}>
            📈 최근 7일 학습 기록
          </h3>
          {recentHistory.length > 0 ? (
            <div>
              {recentHistory.map((record, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px',
                  background: index % 2 === 0 ? '#f9fdf8' : 'white',
                  borderRadius: '8px',
                  marginBottom: '5px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#172f0b', marginBottom: '2px' }}>
                      {new Date(record.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666' }}>
                      {record.wordsStudied}개 단어
                    </div>
                  </div>
                  <div style={{
                    padding: '5px 10px',
                    background: record.correctRate >= 0.8 ? '#d4edda' : record.correctRate >= 0.6 ? '#fff3cd' : '#f8d7da',
                    color: record.correctRate >= 0.8 ? '#155724' : record.correctRate >= 0.6 ? '#856404' : '#721c24',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}>
                    {Math.round(record.correctRate * 100)}%
                  </div>
                </div>
              ))}
              
              <div style={{
                marginTop: '12px',
                padding: '10px',
                background: '#f0f5ee',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '3px' }}>
                  평균 정답률
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#172f0b' }}>
                  {avgCorrectRate}%
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '0.85rem' }}>
              아직 학습 기록이 없습니다.<br/>
              지금 바로 학습을 시작해보세요! 📚
            </div>
          )}
        </div>

        {/* 격려 메시지 */}
        <div style={{
          background: 'linear-gradient(135deg, #5dd9c1, #4fc3ac)',
          borderRadius: '14px',
          padding: '16px',
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
            {learningStats.streak >= 7 ? '🏆' : learningStats.streak >= 3 ? '🌟' : '💪'}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '5px' }}>
            {learningStats.streak >= 7 
              ? '정말 대단해요!' 
              : learningStats.streak >= 3 
                ? '잘하고 있어요!' 
                : '화이팅!'}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            {learningStats.todayStudied > 0
              ? `오늘도 ${learningStats.todayStudied}개 단어를 학습했어요!`
              : '오늘도 열심히 공부해봐요!'}
          </div>
        </div>

        {/* 학습 기록 초기화 버튼 */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={() => {
              if (window.confirm('모든 학습 기록을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
                setLearningStats({
                  todayStudied: 0,
                  weekStudied: 0,
                  monthStudied: 0,
                  totalStudied: 0,
                  streak: 0,
                  lastStudyDate: null,
                  studyHistory: []
                });
                alert('학습 기록이 초기화되었습니다.');
              }
            }}
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              color: '#888',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            🗑️ 학습 기록 초기화
          </button>
        </div>
      </div>
    </div>
  );
}

 // 퀴즈 모드 선택 화면 - 겨울 파스텔 테마
if (currentView === 'quizModeSelect') {
  return (
    <div style={{ 
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)', 
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      <div style={{ 
        width: '100%', 
        maxWidth: '500px', 
        margin: '0 auto', 
        padding: '12px', 
        boxSizing: 'border-box' 
      }}>
        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setCurrentView('list')}
            style={{
              background: 'white',
              border: '2px solid #e2e8f0',
              color: '#172f0b',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← 돌아가기
          </button>
          <h1 style={{ 
            fontSize: '1.2rem', 
            fontWeight: '700', 
            color: '#172f0b',
            margin: 0
          }}>
            퀴즈 모드 선택
          </h1>
          <div style={{ width: '80px' }}></div>
        </div>

        {/* 퀴즈 방향 선택 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: '2px solid rgba(226, 232, 240, 0.5)'
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#475569', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={16} strokeWidth={2.5} style={{ color: '#be123c' }} />
            문제 방향
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setQuizDirection('en-ko')}
              style={{
                flex: 1,
                padding: '12px',
                background: quizDirection === 'en-ko' 
                  ? 'linear-gradient(135deg, #e0f2fe, #bae6fd)' 
                  : 'white',
                color: quizDirection === 'en-ko' ? '#0369a1' : '#64748b',
                border: quizDirection === 'en-ko' ? '2px solid #7dd3fc' : '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              영어 → 한글
            </button>
            <button
              onClick={() => setQuizDirection('ko-en')}
              style={{
                flex: 1,
                padding: '12px',
                background: quizDirection === 'ko-en' 
                  ? 'linear-gradient(135deg, #fce7f3, #fbcfe8)' 
                  : 'white',
                color: quizDirection === 'ko-en' ? '#be123c' : '#64748b',
                border: quizDirection === 'ko-en' ? '2px solid #f9a8d4' : '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              한글 → 영어
            </button>
          </div>
        </div>

        {/* 퀴즈 모드 선택 */}
        <div style={{ display: 'grid', gap: '10px' }}>
          {/* 주관식 (타이핑) - 스카이 블루 */}
          <div
            onClick={() => startQuiz('typing', quizDirection)}
            style={{
              background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid #7dd3fc'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 165, 233, 0.1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
              }}>
                <Edit2 size={22} strokeWidth={2.5} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0369a1', marginBottom: '2px' }}>
                  주관식
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
                  직접 답을 입력하여 풀어요
                </p>
              </div>
            </div>
          </div>

          {/* 객관식 - 에메랄드 */}
          <div
            onClick={() => startQuiz('multiple', quizDirection)}
            style={{
              background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid #6ee7b7'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}>
                <Brain size={22} strokeWidth={2.5} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#047857', marginBottom: '2px' }}>
                  객관식
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
                  4개 보기 중에서 정답을 고르세요
                </p>
              </div>
            </div>
          </div>

          {/* 듣고 쓰기 - 앰버 */}
          <div
            onClick={() => startQuiz('listening', quizDirection)}
            style={{
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid #fcd34d'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
              }}>
                <Headphones size={22} strokeWidth={2.5} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#b45309', marginBottom: '2px' }}>
                  듣고 쓰기
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
                  음성을 듣고 철자를 입력하세요
                </p>
              </div>
            </div>
          </div>

          {/* 철자 맞추기 - 바이올렛 */}
          <div
            onClick={() => startQuiz('spelling', quizDirection)}
            style={{
              background: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(167, 139, 250, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid #a78bfa'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(167, 139, 250, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(167, 139, 250, 0.1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(167, 139, 250, 0.3)'
              }}>
                <Shuffle size={22} strokeWidth={2.5} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#6d28d9', marginBottom: '2px' }}>
                  철자 맞추기
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
                  섞인 글자를 순서대로 배열하세요
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

//홈 화면
 if (currentView === 'home') {
  const dday = examDate ? Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  return (
    <div style={{ 
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)', 
      width: '100vw', 
      minHeight: '100vh', 
      margin: 0, 
      padding: 0, 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      overflowY: 'auto' 
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        html, body, #root, .app-container {
          margin: 0 !important;
          padding: 0 !important;
          font-family: 'Locus_sangsang', sans-serif;
          width: 100% !important;
          overflow-x: hidden !important;
        }
        * {
          font-family: 'Locus_sangsang', sans-serif;
          box-sizing: border-box;
        }

 @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  /* 모바일 반응형 */
  @media (max-width: 768px) {
    .books-grid {
      grid-template-columns: 1fr !important;
    }

    .exam-alert-text {
      font-size: 0.65rem !important;
    }

    .exam-alert-subtext {
      font-size: 0.6rem !important;
    }

    /* 단어장 섹션 헤더 */
    .section-header {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 8px !important;
    }

    .section-title {
      font-size: 0.8rem !important;
    }

    .section-count {
      display: none !important;
    }

    .expand-icon {
      align-self: center !important;
    }

    /* D-DAY 숫자 크기 줄이기 */
    .dday-number {
      font-size: 1.3rem !important;
    }

    /* 출석부 텍스트 크기 줄이기 */
    .attendance-item {
      font-size: 0.65rem !important;
      padding: 6px 8px !important;
    }
  }

      `}</style>

      {/* 상단 헤더 */}
      <div style={{ 
        background: 'transparent', 
        width: '100%', 
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        gap: '8px'
      }}>
        {/* 왼쪽: 로고 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          flex: '0 0 auto'
        }}>
          <h1 style={{ 
            fontFamily: "'Gamja Flower', cursive", 
            fontWeight: 700, 
            fontSize: '1.1rem', 
            margin: 0, 
            display: 'flex',
            alignItems: 'center',
            lineHeight: 1
          }}>
            <span style={{ 
              fontFamily: "'Gamja Flower', cursive", 
              letterSpacing: '-0.05em', 
              marginRight: '0.1em', 
              background: 'linear-gradient(to right, #172f0b, #2d5a1a)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text' 
            }}>MINE</span>
            <span style={{ 
              fontFamily: "'Gamja Flower', cursive", 
              opacity: 0.75, 
              letterSpacing: '-0.05em', 
              background: 'linear-gradient(to right, #172f0b, #2d5a1a)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text' 
            }}>VOCA</span>
          </h1>
          <img 
            src="/66.png"
            alt="Mine Voca Logo" 
            style={{ 
              width: "24px", 
              height: "24px", 
              objectFit: "contain"
            }}
          />
        </div>

        {/* 가운데: 환영 메시지 */}
        <div style={{ 
          flex: '1 1 auto',
          display: 'flex',
          justifyContent: 'center',
          minWidth: 0
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: '#64748b',
            fontWeight: '500',
            whiteSpace: 'nowrap'
          }}>
            우리 {userName ? userName.slice(-2) : '친구'}{userName ? getJosa(userName.slice(-2), '이') : ''}, 지치지 말고 힘내자 🔥
          </span>
        </div>

        {/* 오른쪽: 버튼들 */}
        <div style={{ 
          display: 'flex', 
          gap: '4px',
          alignItems: 'center',
          flex: '0 0 auto'
        }}>
          <button
            onClick={handleLogout}
            style={{ 
              padding: '4px 8px',
              fontSize: '0.55rem',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f1f5f9';
            }}
          >
            로그아웃
          </button>
          <button
            onClick={() => setCurrentView('adminLogin')}
            style={{ 
              padding: '4px 6px',
              fontSize: '0.7rem',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f1f5f9';
            }}
            title="관리자"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* BETA 배지 - 화면 하단 중앙 고정 */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000
      }}>
        <div style={{
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 14px',
  background: 'linear-gradient(135deg, #67e8f9, #22d3ee)',  // 👈 시아노(청록) 파스텔
  color: '#0e7490',  // 👈 텍스트 색상도 변경
  fontSize: '0.65rem',
  fontWeight: '700',
  borderRadius: '20px',
  fontFamily: '"Consolas", Monaco, monospace',
  letterSpacing: '1px',
  boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',  // 👈 그림자도 변경
  border: '2px solid #a5f3fc'  // 👈 테두리도 밝게
}}>
  <span style={{ fontSize: '0.6rem' }}>❄️</span>
  beta v0.5
</div>
      </div>

      {/* 단어장 편집 모달 */}
      {showEditModal && editingBook && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '1.5rem',
              color: '#172f0b',
              fontWeight: '700'
            }}>📝 단어장 수정</h2>
            
            {/* 단어장 이름 입력 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                color: '#333',
                fontSize: '0.95rem'
              }}>
                단어장 이름
              </label>
              <input
                type="text"
                value={editingBook.name}
                onChange={(e) => setEditingBook({...editingBook, name: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6ee7b7'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* 아이콘 선택 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '12px', 
                fontWeight: '600', 
                color: '#333',
                fontSize: '0.95rem'
              }}>
                아이콘 선택
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px'
              }}>
                {bookIcons.map((icon, index) => (
                  <button
                    key={index}
                    onClick={() => setEditingBook({...editingBook, icon: icon})}
                    style={{
                      padding: '12px',
                      border: editingBook.icon === icon ? '3px solid #6ee7b7' : '2px solid #e2e8f0',
                      borderRadius: '12px',
                      backgroundColor: editingBook.icon === icon ? '#f0fdfa' : 'white',
                      fontSize: '1.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      transform: editingBook.icon === icon ? 'scale(1.1)' : 'scale(1)'
                    }}
                    onMouseOver={(e) => {
                      if (editingBook.icon !== icon) {
                        e.currentTarget.style.backgroundColor = '#f9fdf8';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (editingBook.icon !== icon) {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* 버튼들 */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelEdit}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#f5f5f5';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'white';
                }}
              >
                취소
              </button>
              <button
                onClick={updateBook}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #172f0b, #2d5a1a)',
                  color: 'white',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(23, 47, 11, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(23, 47, 11, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(23, 47, 11, 0.3)';
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
          
    {/* 이번 시험범위 단어 알림 */}
      {(() => {
        const examRangeWordCount = words.filter(w => w.bookId === 1 && !w.mastered).length;

        // 암기하지 않은 단어가 0개 = 모두 암기 완료! (단어가 없거나 모두 외운 경우)
        if (examRangeWordCount === 0) {
          return (
            <div style={{
              margin: '0 24px 16px 24px',
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
              borderRadius: '16px',
              color: '#172f0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
              border: '2px solid #f9a8d4'
            }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={18} strokeWidth={2.5} style={{ color: '#ec4899' }} />
                  <span className="exam-alert-text">고생했어요! 시험범위에 있는 단어 모두 암기 완료🩷</span>
                </div>
                <div className="exam-alert-subtext" style={{ fontSize: '0.75rem', opacity: 0.9, color: '#9d174d' }}>
                  정말 대단해요! 시험 잘 보세요!
                </div>
              </div>
            </div>
          );
        }

        // 암기하지 않은 단어가 있는 경우
        if (examRangeWordCount > 0) {
          return (
            <div style={{
              margin: '0 24px 16px 24px',
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              borderRadius: '16px',
              color: '#172f0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              border: '2px solid #fcd34d'
            }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={18} strokeWidth={2.5} style={{ color: '#f59e0b' }} />
                  <span className="exam-alert-text">이번 시험범위에 외워야 할 단어가 {examRangeWordCount}개 남았어요!</span>
                </div>
                <div className="exam-alert-subtext" style={{ fontSize: '0.75rem', opacity: 0.9, color: '#b45309' }}>
                  {userName ? userName.slice(-2) : '친구'}{userName ? getJosa(userName.slice(-2), '아야') : '야'}, 시험 전까지 0개로 만들어야지?
                </div>
              </div>
              <button
                onClick={() => {
                  const examBook = books.find(b => b.id === 1);
                  if (examBook) {
                    selectBook(examBook);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: 'white',
                  color: '#b45309',
                  border: '2px solid #fcd34d',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#fef3c7';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                }}
              >
                학습하기
              </button>
            </div>
          );
        }

        return null;
      })()}

      {/* 중간: 학습통계 + D-DAY + 출석부 */}
        <div className="stats-grid" style={{ margin: '0 24px 20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          
          {/* 왼쪽: 학습통계 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '16px',
            border: '2px solid rgba(226, 232, 240, 0.5)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#172f0b', marginBottom: '12px' }}>
              📊 학습통계
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>오늘</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0369a1' }}>{learningStats.todayStudied || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>연속</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#be123c' }}>{learningStats.streak || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>이번주</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#047857' }}>{learningStats.weekStudied || 0}</span>
              </div>
            </div>
          </div>

          {/* 오른쪽: D-DAY */}
          <div
            onClick={() => {
              console.log('D-day 카드 클릭됨!');
              console.log('showExamModal 상태:', showExamModal);
              setShowExamModal(true);
              console.log('setShowExamModal(true) 호출 완료');
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '16px',
              border: '2px solid rgba(226, 232, 240, 0.5)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            {examName && dday !== null ? (
              <>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>
                  {examName}까지
                </div>
                <div className="dday-number" style={{ fontSize: '2rem', fontWeight: '700', color: '#6d28d9', marginBottom: '4px' }}>
                  D-{dday}
                </div>
                <div style={{ fontSize: '1.5rem' }}>🎯</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
                  시험 일정을
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
                  설정해보세요!
                </div>
                <div style={{ fontSize: '1.5rem' }}>📅</div>
              </>
            )}
          </div>

          {/* 세 번째: 출석부 - 항상 표시 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '16px',
            border: '2px solid rgba(226, 232, 240, 0.5)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxHeight: '180px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* 반 이름 - 있을 때만 표시 */}
            {className && (
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#172f0b', marginBottom: '8px' }}>
                {className}
              </div>
            )}

            {/* 이번주 출석왕 */}
            {weeklyChampion && (
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '10px' }}>
                👑 이번주 출석왕 : {weeklyChampion.userName}
              </div>
            )}

            {/* 오늘 출석 명단 - 2명 이상일 때만 표시 */}
            {todayAttendance.length >= 2 && (
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                paddingRight: '4px'
              }}>
                {todayAttendance.map((student) => (
                  <div
                    key={student.userId}
                    className="attendance-item"
                    style={{
                      padding: '8px 12px',
                      background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      color: '#78350f',
                      border: '1px solid #fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span>{student.userName}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({student.className})</span>
                    <span>열공중🌅</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


      {/* 새 단어장 입력 */}
      {showBookInput && (
        <div style={{ width: '100%', padding: '0 24px', marginBottom: '20px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            padding: '16px',
            border: '2px solid rgba(226, 232, 240, 0.5)'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newBookName}
                onChange={(e) => setNewBookName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addBook()}
                placeholder="단어장 이름을 입력하세요"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
                autoFocus
              />
              <button
                onClick={addBook}
                style={{
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  color: 'white',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                }}
              >
                추가
              </button>
              <button
                onClick={() => {
                  setShowBookInput(false);
                  setNewBookName('');
                }}
                style={{
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  color: '#666',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap'
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📝 오늘의 단어 시험 - 크고 눈에 띄게 */}
      {currentTest && new Date(currentTest.deadline) > new Date() && (
        <div style={{ width: '100%', padding: '0 24px', marginBottom: '24px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #fef3c7, #fde68a, #fed7aa)',
              border: '3px solid #f59e0b',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* 배경 장식 */}
            <div style={{
              position: 'absolute',
              top: '-50px',
              right: '-50px',
              width: '200px',
              height: '200px',
              background: 'rgba(251, 191, 36, 0.1)',
              borderRadius: '50%'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-30px',
              left: '-30px',
              width: '150px',
              height: '150px',
              background: 'rgba(251, 191, 36, 0.1)',
              borderRadius: '50%'
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                  fontSize: '3rem',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}>
                  📝
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{
                    fontSize: '1.8rem',
                    fontWeight: 900,
                    color: '#78350f',
                    margin: 0,
                    textShadow: '0 2px 4px rgba(120, 53, 15, 0.1)'
                  }}>
                    오늘의 단어 시험
                  </h2>
                  <p style={{
                    fontSize: '0.95rem',
                    color: '#92400e',
                    margin: '4px 0 0 0',
                    fontWeight: 600
                  }}>
                    {currentTest.title}
                  </p>
                </div>
              </div>

              {/* 시험 정보 */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                border: '2px solid rgba(251, 191, 36, 0.3)'
              }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>
                      단어 개수
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#78350f' }}>
                      {currentTest.wordIds.length}개
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>
                      마감 시간
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626' }}>
                      {new Date(currentTest.deadline).toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, marginBottom: '4px' }}>
                      남은 시간
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ea580c' }}>
                      {(() => {
                        const diff = new Date(currentTest.deadline) - new Date();
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        return `${hours}시간 ${minutes}분`;
                      })()}
                    </div>
                  </div>
                </div>

                {/* 시험 시작 버튼 */}
                <button
                  onClick={async () => {
                    // 시험용 단어들을 Firebase에서 직접 로드
                    try {
                      const testWords = [];
                      for (const wordId of currentTest.wordIds) {
                        const wordDoc = await getDoc(doc(db, 'dictionary', wordId));
                        if (wordDoc.exists()) {
                          testWords.push({ id: wordDoc.id, ...wordDoc.data() });
                        }
                      }

                      if (testWords.length === 0) {
                        alert('시험 단어를 불러올 수 없습니다.');
                        return;
                      }

                      const shuffledWords = [...testWords].sort(() => Math.random() - 0.5);
                      setQuizWords(shuffledWords);
                      setQuizMode('typing');
                      setQuizDirection('en-ko');
                      setCurrentCardIndex(0);
                      setQuizAnswer('');
                      setQuizResult(null);
                      setScore({ correct: 0, total: 0 });
                      setCurrentView('quiz');
                    } catch (error) {
                      console.error('시험 단어 로드 오류:', error);
                      alert('시험을 시작할 수 없습니다.');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '20px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1.2rem',
                    fontWeight: 900,
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(217, 119, 6, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.4)';
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>✏️</span>
                  지금 시험 보기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📚 단어장 섹션 - 2단 레이아웃 */}
      <div className="books-grid" style={{
        width: '100%',
        padding: '0 24px',
        marginBottom: '24px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        alignItems: 'start'
      }}>

        {/* 나의 단어장 섹션 (2x2 그리드) */}
        <div style={{ width: '100%', padding: '0 24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
            📚 나의 단어장
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px'
          }}>
            {/* 이번 시험범위 */}
            {books.filter(b => b.id === 1).map(book => (
              <div
                key={book.id}
                onClick={() => selectBook(book)}
                style={{
                  background: 'white',
                  border: '2px solid #fbbf24',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎯</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                  이번 시험범위
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {words.filter(w => w.bookId === book.id && !w.mastered).length}개
                </div>
              </div>
            ))}

            {/* 암기완료 */}
            <div
              onClick={() => setCurrentView('memorized')}
              style={{
                background: 'white',
                border: '2px solid #10b981',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                암기완료
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {words.filter(w => w.mastered).length}개
              </div>
            </div>

            {/* 오답노트 */}
            <div
              onClick={() => setCurrentView('wrongNote')}
              style={{
                background: 'white',
                border: '2px solid #ef4444',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                오답노트
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {words.filter(w => w.wrongNote).length}개
              </div>
            </div>

            {/* 새 단어장 추가 */}
            <div
              onClick={() => setShowBookInput(true)}
              style={{
                background: 'white',
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#94a3b8';
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = 'white';
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px', color: '#94a3b8' }}>+</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                새 단어장
              </div>
            </div>
          </div>
        </div>

        {/* 교재 단어장 섹션 */}
        <div style={{ width: '100%', padding: '0 24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
            📖 교재 단어장
          </h3>
          {books.filter(b => b.category === '교재단어장').length === 0 ? (
            <div style={{
              background: 'white',
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              color: '#94a3b8'
            }}>
              아직 교재 단어장이 없습니다
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {books.filter(b => b.category === '교재단어장').map(book => (
                <div
                    key={book.id}
                    onClick={() => selectBook(book)}
                    style={{
                      background: 'white',
                      border: book.isExamRange ? '2px solid #fbbf24' : '2px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* 왼쪽: 아이콘 */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: book.isExamRange ? '#fef3c7' : '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '1.3rem'
                    }}>
                      📚
                    </div>

                    {/* 중간: 이름과 개수 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#1e293b',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {book.name}
                        {book.isExamRange && <span style={{ marginLeft: '4px', fontSize: '0.75rem' }}>⭐</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        학습중 {words.filter(w => w.bookId === book.id && !w.mastered).length}개
                      </div>
                    </div>

                    {/* 오른쪽: 버튼들 */}
                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      flexShrink: 0
                    }} onClick={(e) => e.stopPropagation()}>
                      {/* 시험범위 토글 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExamRange(book.id);
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: book.isExamRange ? '#fef3c7' : '#f8fafc',
                          border: book.isExamRange ? '1px solid #fbbf24' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={book.isExamRange ? '시험범위에서 제외' : '시험범위에 추가'}
                      >
                        {book.isExamRange ? '⭐' : '☆'}
                      </button>

                      {/* 수정 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(book);
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="이름 수정"
                      >
                        ✏️
                      </button>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBook(book.id);
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 단어 시험 관리 버튼 (관리자 전용) */}
      {isAdmin && (
        <div style={{ width: '100%', padding: '0 24px', marginBottom: '24px' }}>
          <button
            onClick={() => {
              setCurrentView('testManagement');
              loadAllWords();
            }}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
              border: '2px solid #fbbf24',
              borderRadius: '16px',
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(251, 191, 36, 0.15)',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(251, 191, 36, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.15)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  boxShadow: '0 4px 8px rgba(251, 191, 36, 0.3)'
                }}>
                  📝
                </div>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#78350f', margin: 0 }}>
                    단어 시험 관리
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                    {currentTest ? '진행 중인 시험 있음' : '진행 중인 시험 없음'}
                  </p>
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', color: '#94a3b8' }}>→</div>
            </div>
          </button>
        </div>
      )}

      {/* ⚠️ 재시험 알림 - 90% 미만 통과 시험 */}
      {myTestResults.filter(result => !result.passed && currentTest && result.testId === currentTest.id).length > 0 && (
        <div style={{ width: '100%', padding: '0 24px', marginBottom: '24px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
              border: '3px solid #ef4444',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '2rem' }}>⚠️</div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                  재시험이 필요해요!
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#7f1d1d', margin: '4px 0 0 0' }}>
                  90% 이상 점수를 받아야 합니다
                </p>
              </div>
            </div>
            {myTestResults
              .filter(result => !result.passed && currentTest && result.testId === currentTest.id)
              .map((result, index) => (
                <div
                  key={index}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    marginTop: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1f2937' }}>
                        {result.testTitle}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>
                        최근 점수: {result.score}% ({result.correct}/{result.total})
                      </div>
                    </div>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: result.score >= 70 ? '#f59e0b' : '#ef4444'
                    }}>
                      {result.score}%
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 하단 유틸리티 버튼 */}
      <div style={{ width: '100%', padding: '0 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* 새 단어장 추가 버튼 */}
          <button
            onClick={() => setShowBookInput(true)}
            style={{
              flex: 1,
              padding: '16px',
              background: 'linear-gradient(135deg, #fecdd3, #fda4af)',
              border: '2px solid #fb7185',
              borderRadius: '16px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#881337',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(251, 113, 133, 0.2)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 113, 133, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 113, 133, 0.2)';
            }}
          >
            <Plus size={20} strokeWidth={2.5} />
            <span>새 단어장</span>
          </button>

          {/* 상세 통계 버튼 */}
          <button
            onClick={() => setCurrentView('stats')}
            style={{
              flex: 1,
              padding: '16px',
              background: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)',
              border: '2px solid #a78bfa',
              borderRadius: '16px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#5b21b6',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(167, 139, 250, 0.2)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(167, 139, 250, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(167, 139, 250, 0.2)';
            }}
          >
            <BarChart3 size={20} strokeWidth={2.5} />
            <span>상세 통계</span>
          </button>
        </div>
      </div>

      {/* 시험 일정 설정 모달 */}
      {(() => {
        console.log('홈 화면 모달 렌더링 체크 - showExamModal:', showExamModal);
        return showExamModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowExamModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '32px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              margin: '0 0 24px 0',
              fontSize: '1.3rem',
              fontWeight: '700',
              color: '#172f0b',
              textAlign: 'center'
            }}>
              📅 시험 일정 설정
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#334155'
              }}>
                시험명
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="예: 중간고사, 기말고사"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6d28d9'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#334155'
              }}>
                시험 날짜
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6d28d9'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowExamModal(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (examName.trim() && examDate) {
                    setShowExamModal(false);
                  } else {
                    alert('시험명과 날짜를 모두 입력해주세요!');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #a78bfa, #8b5cf6)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      );
      })()}

    </div>
  );
}

  // 관리자 로그인 화면 - 겨울 파스텔 테마
if (currentView === 'adminLogin') {
  return (
    <div style={{ 
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)', 
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>
      
      <div style={{ width: '100%', maxWidth: '420px', padding: '0 20px', boxSizing: 'border-box' }}>
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.9)', 
          backdropFilter: 'blur(10px)',
          borderRadius: '20px', 
          padding: '28px', 
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          border: '2px solid rgba(226, 232, 240, 0.5)'
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#172f0b', marginBottom: '20px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Settings size={24} strokeWidth={2.5} style={{ color: '#6d28d9' }} />
            관리자 로그인
          </h2>
          
          <input
            type="password"
            placeholder="관리자 비밀번호"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '2px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '0.95rem',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '14px',
              transition: 'border 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#a78bfa'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            autoFocus
          />
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleAdminLogin}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
              }}
            >
              로그인
            </button>
            <button
              onClick={() => {
                setCurrentView('home');
                setAdminPassword('');
              }}
              style={{
                flex: 1,
                background: 'white',
                color: '#475569',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 관리자 페이지 - 겨울 파스텔 테마
if (currentView === 'admin' && isAdmin) {
  return (
    <div style={{ 
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)', 
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      <div style={{ 
        background: 'transparent', 
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => {
            setCurrentView('home');
            setIsAdmin(false);
            setAdminPassword('');
          }}
          style={{
            background: 'white',
            border: '2px solid #e2e8f0',
            color: '#172f0b',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px'
          }}
        >
          ← 홈으로
        </button>
        <h1 style={{ 
          fontFamily: "'Gamja Flower', cursive", 
          fontWeight: 700, 
          fontSize: '1.3rem', 
          margin: 0,
          color: '#172f0b',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Settings size={24} strokeWidth={2.5} style={{ color: '#6d28d9' }} />
          관리자 페이지
        </h1>
        <div style={{ width: '70px' }}></div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px 24px',
        boxSizing: 'border-box'
      }}>
        {/* 잘못된 단어 정리 버튼 */}
        <button
          onClick={async () => {
            if (!window.confirm('공백이 포함된 잘못된 단어 ID를 정리합니다.\n계속하시겠습니까?')) return;

            try {
              const dictionaryRef = collection(db, 'dictionary');
              const snapshot = await getDocs(dictionaryRef);
              let fixedCount = 0;
              let errorCount = 0;
              let problemWords = [];

              console.log(`📚 총 ${snapshot.docs.length}개 단어 검사 중...`);

              for (const docSnap of snapshot.docs) {
                const docId = docSnap.id;
                // 따옴표, 공백, 대소문자 모두 정리
                const trimmedId = docId.trim().replace(/^["']|["']$/g, '').trim().toLowerCase();

                // 디버깅: 모든 문서 ID 확인
                if (docId.length !== trimmedId.length || docId !== trimmedId) {
                  console.log(`🔍 문제 발견: "${docId}" (길이: ${docId.length}) → "${trimmedId}" (길이: ${trimmedId.length})`);
                  problemWords.push(docId);
                }

                // ID에 따옴표, 공백이 있거나 대소문자가 다른 경우
                if (docId !== trimmedId) {
                  try {
                    const data = docSnap.data();
                    // 새로운 올바른 ID로 문서 생성
                    await setDoc(doc(db, 'dictionary', trimmedId), {
                      ...data,
                      english: trimmedId,
                      updatedAt: new Date().toISOString()
                    });
                    // 잘못된 문서 삭제
                    await deleteDoc(doc(db, 'dictionary', docId));
                    fixedCount++;
                    console.log(`✅ 수정됨: "${docId}" → "${trimmedId}"`);
                  } catch (err) {
                    console.error(`❌ 수정 실패: ${docId}`, err);
                    errorCount++;
                  }
                }
              }

              console.log('🔍 문제 단어 목록:', problemWords);
              alert(`정리 완료!\n📚 총 검사: ${snapshot.docs.length}개\n🔍 문제 발견: ${problemWords.length}개\n✅ 수정됨: ${fixedCount}개\n❌ 실패: ${errorCount}개`);
            } catch (error) {
              console.error('단어 정리 오류:', error);
              alert('단어 정리 중 오류가 발생했습니다.');
            }
          }}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            marginBottom: '16px',
            border: '2px solid rgba(254, 202, 202, 0.5)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Trash2 size={28} strokeWidth={2.5} style={{ color: '#ef4444' }} />
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
                  잘못된 단어 정리
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  공백이 포함된 단어 ID 자동 수정
                </p>
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', color: '#94a3b8' }}>🧹</div>
          </div>
        </button>

        {/* 단어 관리 버튼 */}
        <button
          onClick={() => {
            setCurrentView('wordManagement');
            loadAllWords();
          }}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            marginBottom: '16px',
            border: '2px solid rgba(226, 232, 240, 0.5)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Book size={28} strokeWidth={2.5} style={{ color: '#0ea5e9' }} />
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
                  단어 관리
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  단어 업로드 및 수정, 삭제
                </p>
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', color: '#94a3b8' }}>→</div>
          </div>
        </button>

        {/* 반별 단어장 관리 버튼 */}
        <button
          onClick={() => {
            setCurrentView('classWordManagement');
            loadAllClasses();
          }}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            marginBottom: '16px',
            border: '2px solid rgba(251, 191, 36, 0.5)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Album size={28} strokeWidth={2.5} style={{ color: '#f59e0b' }} />
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
                  반별 단어장 관리
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  반 단위로 교재단어장 배포 및 관리
                </p>
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', color: '#94a3b8' }}>→</div>
          </div>
        </button>

        {/* 중복 단어 통합 버튼 */}
        <button
          onClick={() => {
            setCurrentView('duplicateMerge');
            loadAllWords();
          }}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            marginBottom: '16px',
            border: '2px solid rgba(226, 232, 240, 0.5)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '1.5rem' }}>🔀</div>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
                  중복 단어 통합
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  중복 업로드된 단어를 찾아서 통합
                </p>
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', color: '#94a3b8' }}>→</div>
          </div>
        </button>

        {/* 반 관리 섹션 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          marginBottom: '16px',
          border: '2px solid rgba(226, 232, 240, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#172f0b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Album size={20} strokeWidth={2.5} style={{ color: '#0369a1' }} />
              반 관리 ({classes.length}개)
            </h2>
            <button
              onClick={() => setShowClassForm(!showClassForm)}
              style={{
                padding: '6px 12px',
                background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
                color: '#0369a1',
                border: '2px solid #0ea5e9',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ 새 반 만들기
            </button>
          </div>

          {showClassForm && (
            <div style={{
              background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '14px',
              border: '2px solid #7dd3fc'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createClass()}
                  placeholder="반 이름 입력 (예: 1학년 1반)"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '2px solid #7dd3fc',
                    borderRadius: '10px',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  onClick={createClass}
                  style={{
                    padding: '10px 16px',
                    background: '#0ea5e9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  생성
                </button>
                <button
                  onClick={() => {
                    setShowClassForm(false);
                    setNewClassName('');
                  }}
                  style={{
                    padding: '10px 16px',
                    background: 'white',
                    color: '#475569',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {classes.length > 0 ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {classes.map(classItem => (
                <div
                  key={classItem.id}
                  style={{
                    background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                    borderRadius: '12px',
                    padding: '14px',
                    border: '2px solid #7dd3fc'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '1.2rem' }}>🏫</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0369a1' }}>
                        {classItem.className}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#0c4a6e' }}>
                        ID: {classItem.id}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              border: '2px dashed #cbd5e1'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📚</div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>
                아직 생성된 반이 없어요
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                새 반 만들기 버튼을 눌러 반을 만들어보세요
              </div>
            </div>
          )}
        </div>

        {/* 학생 관리 버튼 */}
        <button
          onClick={() => setCurrentView('studentManagement')}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            marginBottom: '16px',
            border: '2px solid rgba(226, 232, 240, 0.5)',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <GraduationCap size={28} strokeWidth={2.5} style={{ color: '#be123c' }} />
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
                  학생 관리
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  등록된 학생 {students.length}명
                </p>
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', color: '#94a3b8' }}>→</div>
          </div>
          {students.filter(s => s.daysInactive >= 3).length > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '10px 12px',
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              borderRadius: '10px',
              border: '2px solid #fcd34d',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#b45309' }}>
                {students.filter(s => s.daysInactive >= 3).length}명의 학생이 주의가 필요해요
              </span>
            </div>
          )}
        </button>

        {/* 단어 시험 관리 버튼 */}
        <button
          onClick={() => {
            setCurrentView('testManagement');
            loadAllWords();
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
            border: '2px solid #fbbf24',
            borderRadius: '16px',
            padding: '24px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(251, 191, 36, 0.15)',
            marginBottom: '16px',
            textAlign: 'left'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(251, 191, 36, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.15)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                boxShadow: '0 4px 8px rgba(251, 191, 36, 0.3)'
              }}>
                📝
              </div>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#78350f', margin: 0 }}>
                  단어 시험 관리
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  {currentTest ? '진행 중인 시험 있음' : '진행 중인 시험 없음'}
                </p>
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', color: '#94a3b8' }}>→</div>
          </div>
        </button>
      </div>

      {/* 시험 일정 설정 모달 */}
      {showExamModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowExamModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '32px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              margin: '0 0 24px 0',
              fontSize: '1.3rem',
              fontWeight: '700',
              color: '#172f0b',
              textAlign: 'center'
            }}>
              📅 시험 일정 설정
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#334155'
              }}>
                시험명
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="예: 중간고사, 기말고사"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6d28d9'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#334155'
              }}>
                시험 날짜
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6d28d9'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowExamModal(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (examName.trim() && examDate) {
                    setShowExamModal(false);
                  } else {
                    alert('시험명과 날짜를 모두 입력해주세요!');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #a78bfa, #8b5cf6)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 학생 관리 전체 화면
if (currentView === 'studentManagement' && isAdmin) {
  return (
    <div style={{
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      {/* 헤더 */}
      <div style={{
        background: 'transparent',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => setCurrentView('admin')}
          style={{
            background: 'white',
            border: '2px solid #e2e8f0',
            color: '#172f0b',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px'
          }}
        >
          ← 뒤로
        </button>
        <h1 style={{
          fontFamily: "'Gamja Flower', cursive",
          fontWeight: 700,
          fontSize: '1.3rem',
          margin: 0,
          color: '#172f0b',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <GraduationCap size={24} strokeWidth={2.5} style={{ color: '#be123c' }} />
          학생 관리
        </h1>
        <button
          onClick={loadAllStudents}
          style={{
            background: 'white',
            border: '2px solid #e2e8f0',
            color: '#475569',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px'
          }}
        >
          🔄 새로고침
        </button>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px 24px',
        boxSizing: 'border-box'
      }}>
        {/* 통계 카드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)',
            borderRadius: '12px',
            padding: '16px',
            border: '2px solid #a78bfa',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#5b21b6', fontWeight: '600', marginBottom: '4px' }}>
              전체 학생
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#6d28d9' }}>
              {students.length}
            </div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
            borderRadius: '12px',
            padding: '16px',
            border: '2px solid #6ee7b7',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: '600', marginBottom: '4px' }}>
              활동 중
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#047857' }}>
              {students.filter(s => s.daysInactive < 3).length}
            </div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            borderRadius: '12px',
            padding: '16px',
            border: '2px solid #fcd34d',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: '600', marginBottom: '4px' }}>
              주의 필요
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#b45309' }}>
              {students.filter(s => s.daysInactive >= 3).length}
            </div>
          </div>
        </div>

        {/* 비활성 학생 알림 */}
        {students.filter(s => s.daysInactive >= 3).length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '16px',
            border: '2px solid #fcd34d'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '1.5rem' }}>⚠️</div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '2px', color: '#b45309' }}>
                  주의가 필요한 학생이 있어요!
                </div>
                <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
                  {students.filter(s => s.daysInactive >= 3).length}명의 학생이 3일 이상 학습하지 않았어요
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 학생 목록 */}
        {students.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
            {students.map(student => {
              const isInactive = student.daysInactive >= 3;
              const lastStudyText = student.lastStudyDate
                ? student.daysInactive === 0
                  ? '오늘 학습함 ✨'
                  : student.daysInactive === 1
                    ? '어제 학습함'
                    : `${student.daysInactive}일 전 학습`
                : '학습 기록 없음';

              return (
                <div
                  key={student.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    padding: '16px',
                    border: `2px solid ${isInactive ? '#fcd34d' : '#e2e8f0'}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
                        👨‍🎓 {student.name}
                      </h3>
                      {isInactive && (
                        <span style={{
                          padding: '4px 10px',
                          background: '#fbbf24',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '0.7rem',
                          fontWeight: '700'
                        }}>
                          ⚠️ 주의
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                      {student.email}
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: isInactive ? '#b45309' : '#047857',
                      fontWeight: '600'
                    }}>
                      {lastStudyText}
                    </div>
                  </div>

                  {student.stats ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '10px',
                      padding: '14px',
                      background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                      borderRadius: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>오늘</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#0369a1' }}>
                          {student.stats.todayStudied}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>연속</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#be123c' }}>
                          {student.stats.streak}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>이번 주</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#047857' }}>
                          {student.stats.weekStudied}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>총</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#6d28d9' }}>
                          {student.stats.totalStudied}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '14px',
                      background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                      borderRadius: '12px',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: '0.85rem',
                      marginBottom: '12px'
                    }}>
                      아직 학습을 시작하지 않았어요
                    </div>
                  )}

                  {/* 반 배정 드롭다운 */}
                  <div style={{
                    padding: '14px',
                    background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px', fontWeight: '600' }}>
                      🏫 반 배정
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select
                        value={student.classId || ''}
                        onChange={(e) => {
                          const selectedClass = classes.find(c => c.id === e.target.value);
                          if (selectedClass) {
                            assignStudentToClass(student.id, student.name, selectedClass.id, selectedClass.className);
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: 'white'
                        }}
                      >
                        <option value="">반 선택...</option>
                        {classes.map(classItem => (
                          <option key={classItem.id} value={classItem.id}>
                            {classItem.className}
                          </option>
                        ))}
                      </select>
                      {student.className && (
                        <div style={{
                          padding: '8px 14px',
                          background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: '#0369a1',
                          border: '2px solid #0ea5e9'
                        }}>
                          {student.className}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '48px',
            textAlign: 'center',
            border: '2px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>👨‍🎓</div>
            <div style={{ fontSize: '1rem', color: '#64748b', fontWeight: '600' }}>
              등록된 학생이 없습니다
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>
              학생들이 회원가입하면 여기에 표시됩니다
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 단어 시험 관리 화면
if (currentView === 'testManagement' && isAdmin) {
  return (
    <div style={{
      background: 'linear-gradient(to bottom right, #fef3c7, #fde68a, #fed7aa)',
      minHeight: '100vh',
      padding: '24px'
    }}>
      {/* 헤더 */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <button
            onClick={() => setCurrentView('home')}
            style={{
              background: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#64748b'
            }}
          >
            ← 돌아가기
          </button>
        </div>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 900,
          color: '#78350f',
          margin: 0
        }}>
          📝 단어 시험 관리
        </h1>
      </div>

      {/* 메인 컨텐츠 */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* 새 시험 만들기 */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '2px solid #fbbf24',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#78350f', marginBottom: '16px' }}>
            새 시험 만들기
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
              시험 제목
            </label>
            <input
              type="text"
              placeholder="예: 1학기 중간고사 영어 단어"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => e.target.style.borderColor = '#fbbf24'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
              마감 시간
            </label>
            <input
              type="datetime-local"
              value={testDeadline}
              onChange={(e) => setTestDeadline(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => e.target.style.borderColor = '#fbbf24'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
              대상 반 선택
            </label>
            <select
              value={selectedTestClassId}
              onChange={(e) => {
                const classId = e.target.value;
                setSelectedTestClassId(classId);
                setSelectedTestBookIds([]); // 반 변경 시 단어장 선택 초기화
                setSelectedRetestStudentIds([]); // 학생 선택 초기화
                if (classId) {
                  loadClassBooks(classId); // 해당 반의 단어장 로드
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit',
                backgroundColor: 'white'
              }}
              onFocus={(e) => e.target.style.borderColor = '#fbbf24'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="">반을 선택하세요</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.className}
                </option>
              ))}
            </select>
          </div>

          {/* 시험 유형 선택 */}
          {selectedTestClassId && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                시험 유형
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${testType === 'regular' ? '#fbbf24' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  background: testType === 'regular' ? '#fffbeb' : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <input
                    type="radio"
                    name="testType"
                    value="regular"
                    checked={testType === 'regular'}
                    onChange={(e) => {
                      setTestType(e.target.value);
                      setSelectedTestBookIds([]);
                      setSelectedRetestStudentIds([]);
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#78350f' }}>🎯 일반 시험</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>단어장에서 랜덤 출제</div>
                  </div>
                </label>
                <label style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${testType === 'retest' ? '#fbbf24' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  background: testType === 'retest' ? '#fffbeb' : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <input
                    type="radio"
                    name="testType"
                    value="retest"
                    checked={testType === 'retest'}
                    onChange={(e) => {
                      setTestType(e.target.value);
                      setSelectedTestBookIds([]);
                      setSelectedRetestStudentIds([]);
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#78350f' }}>🔄 재시험</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>학생별 틀린 단어</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 단어장 선택 */}
          {selectedTestClassId && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                {testType === 'retest' ? '단어장 선택 (하나만)' : '단어장 선택 (여러 개 가능)'}
              </label>
              <div style={{
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px',
                maxHeight: '200px',
                overflowY: 'auto',
                background: '#f9fafb'
              }}>
                {classBooks.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                    이 반에 교재단어장이 없습니다
                  </div>
                ) : (
                  classBooks
                    .filter(book => book.category === '교재단어장')
                    .map(book => (
                      <label
                        key={book.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          marginBottom: '4px',
                          background: selectedTestBookIds.includes(book.id) ? '#fef3c7' : 'transparent'
                        }}
                        onMouseEnter={(e) => !selectedTestBookIds.includes(book.id) && (e.currentTarget.style.background = '#f3f4f6')}
                        onMouseLeave={(e) => !selectedTestBookIds.includes(book.id) && (e.currentTarget.style.background = 'transparent')}
                      >
                        <input
                          type={testType === 'retest' ? 'radio' : 'checkbox'}
                          name={testType === 'retest' ? 'retestBook' : undefined}
                          checked={selectedTestBookIds.includes(book.id)}
                          onChange={(e) => {
                            if (testType === 'retest') {
                              setSelectedTestBookIds([book.id]);
                              setSelectedRetestStudentIds([]);
                            } else {
                              if (e.target.checked) {
                                setSelectedTestBookIds([...selectedTestBookIds, book.id]);
                              } else {
                                setSelectedTestBookIds(selectedTestBookIds.filter(id => id !== book.id));
                              }
                            }
                          }}
                        />
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{book.name}</span>
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>({book.wordCount || 0}개)</span>
                      </label>
                    ))
                )}
              </div>
            </div>
          )}

          {/* 일반 시험: 단어 개수 입력 */}
          {selectedTestClassId && testType === 'regular' && selectedTestBookIds.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                출제할 단어 개수
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={testWordCount}
                onChange={(e) => setTestWordCount(parseInt(e.target.value) || 10)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = '#fbbf24'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0' }}>
                선택된 단어장에서 랜덤으로 {testWordCount}개 출제됩니다
              </p>
            </div>
          )}

          {/* 재시험: 학생 선택 */}
          {selectedTestClassId && testType === 'retest' && selectedTestBookIds.length === 1 && (() => {
            const selectedClass = classes.find(c => c.id === selectedTestClassId);
            const selectedBookId = selectedTestBookIds[0];

            const studentsWithWrongWords = selectedClass?.students?.filter(studentId => {
              const student = students.find(s => s.uid === studentId);
              if (!student) return false;

              const wrongWords = student.words?.filter(word =>
                word.bookId === selectedBookId &&
                word.correctStreak === 0 &&
                word.reviewCount > 0
              );

              return wrongWords && wrongWords.length > 0;
            }) || [];

            return (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                  재시험 대상 학생 선택
                </label>
                <div style={{
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: '#f9fafb'
                }}>
                  {studentsWithWrongWords.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                      이 단어장에서 틀린 단어가 있는 학생이 없습니다
                    </div>
                  ) : (
                    studentsWithWrongWords.map(studentId => {
                      const student = students.find(s => s.uid === studentId);
                      const wrongWordCount = student?.words?.filter(word =>
                        word.bookId === selectedBookId &&
                        word.correctStreak === 0 &&
                        word.reviewCount > 0
                      ).length || 0;

                      return (
                        <label
                          key={studentId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            marginBottom: '4px',
                            background: selectedRetestStudentIds.includes(studentId) ? '#fef3c7' : 'transparent'
                          }}
                          onMouseEnter={(e) => !selectedRetestStudentIds.includes(studentId) && (e.currentTarget.style.background = '#f3f4f6')}
                          onMouseLeave={(e) => !selectedRetestStudentIds.includes(studentId) && (e.currentTarget.style.background = 'transparent')}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRetestStudentIds.includes(studentId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRetestStudentIds([...selectedRetestStudentIds, studentId]);
                              } else {
                                setSelectedRetestStudentIds(selectedRetestStudentIds.filter(id => id !== studentId));
                              }
                            }}
                          />
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{student?.userName || '이름 없음'}</span>
                          <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                            (틀린 단어 {wrongWordCount}개)
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {studentsWithWrongWords.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '8px 0 0 0' }}>
                    선택된 학생들의 틀린 단어만 모아서 시험을 출제합니다
                  </p>
                )}
              </div>
            );
          })()}

          <button
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(217, 119, 6, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.4)';
            }}
            onClick={async () => {
              // 입력 검증
              if (!testTitle || !testDeadline || !selectedTestClassId) {
                alert('시험 제목, 마감 시간, 반을 선택해주세요!');
                return;
              }

              if (selectedTestBookIds.length === 0) {
                alert('단어장을 선택해주세요!');
                return;
              }

              if (testType === 'retest' && selectedRetestStudentIds.length === 0) {
                alert('재시험 대상 학생을 선택해주세요!');
                return;
              }

              const testId = 'test_' + Date.now();
              const selectedClass = classes.find(c => c.id === selectedTestClassId);
              let finalWordIds = [];

              if (testType === 'regular') {
                // 일반 시험: 선택된 단어장들에서 랜덤으로 N개 추출
                const bookWords = allWords.filter(word =>
                  selectedTestBookIds.includes(word.bookId)
                );

                if (bookWords.length === 0) {
                  alert('선택된 단어장에 단어가 없습니다!');
                  return;
                }

                // 랜덤 섞기
                const shuffled = [...bookWords].sort(() => Math.random() - 0.5);
                // testWordCount개만 선택 (또는 전체 단어 수보다 적으면 전체)
                finalWordIds = shuffled.slice(0, Math.min(testWordCount, shuffled.length)).map(w => w.id);

              } else {
                // 재시험: 선택된 학생들의 틀린 단어만 모으기
                const selectedBookId = selectedTestBookIds[0];
                const wrongWordIds = new Set();

                for (const studentId of selectedRetestStudentIds) {
                  const student = students.find(s => s.uid === studentId);
                  if (student && student.words) {
                    const wrongWords = student.words.filter(word =>
                      word.bookId === selectedBookId &&
                      word.correctStreak === 0 &&
                      word.reviewCount > 0
                    );
                    wrongWords.forEach(word => wrongWordIds.add(word.id));
                  }
                }

                finalWordIds = Array.from(wrongWordIds);

                if (finalWordIds.length === 0) {
                  alert('선택된 학생들이 틀린 단어가 없습니다!');
                  return;
                }
              }

              const newTest = {
                id: testId,
                title: testTitle,
                deadline: new Date(testDeadline).toISOString(),
                wordIds: finalWordIds,
                classId: selectedTestClassId,
                className: selectedClass?.className || '',
                testType: testType,
                bookIds: selectedTestBookIds,
                wordCount: testType === 'regular' ? testWordCount : finalWordIds.length,
                studentIds: testType === 'retest' ? selectedRetestStudentIds : null,
                createdBy: currentUser.uid,
                createdAt: new Date().toISOString()
              };

              // tests 컬렉션에 저장
              try {
                await setDoc(doc(db, 'tests', testId), newTest);

                // 폼 초기화
                setTestTitle('');
                setTestDeadline('');
                setSelectedTestBookIds([]);
                setSelectedRetestStudentIds([]);
                setSelectedTestClassId('');
                setTestType('regular');
                setTestWordCount(10);

                const testTypeLabel = testType === 'regular' ? '일반 시험' : '재시험';
                alert(`${testTypeLabel}이 생성되었습니다!\n반: ${selectedClass?.className}\n단어 수: ${finalWordIds.length}개`);
                await loadAllTests(); // 목록 새로고침
                setCurrentView('admin');
              } catch (error) {
                console.error('시험 생성 오류:', error);
                alert('시험 생성 중 오류가 발생했습니다.');
              }
            }}
          >
            시험 만들기
          </button>
        </div>

        {/* 모든 시험 목록 */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          border: '2px solid #10b981',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#047857', marginBottom: '16px' }}>
            등록된 시험 목록 ({allTests.length}개)
          </h2>

          {allTests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              등록된 시험이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {allTests.map(test => (
                <div
                  key={test.id}
                  style={{
                    background: new Date(test.deadline) > new Date() ? '#f0fdf4' : '#fef2f2',
                    borderRadius: '12px',
                    padding: '20px',
                    border: new Date(test.deadline) > new Date() ? '2px solid #bbf7d0' : '2px solid #fecaca'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div>
                      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>
                        {test.title}
                      </p>
                      <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
                        대상 반: {test.className}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`"${test.title}" 시험을 삭제하시겠습니까?`)) {
                          try {
                            await deleteDoc(doc(db, 'tests', test.id));
                            alert('시험이 삭제되었습니다.');
                            await loadAllTests();
                          } catch (error) {
                            console.error('시험 삭제 오류:', error);
                            alert('삭제 중 오류가 발생했습니다.');
                          }
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#ef4444',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      삭제
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>단어 개수</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#047857' }}>
                        {test.wordIds.length}개
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>마감 시간</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: new Date(test.deadline) > new Date() ? '#047857' : '#dc2626' }}>
                        {new Date(test.deadline).toLocaleString('ko-KR')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>상태</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: new Date(test.deadline) > new Date() ? '#047857' : '#64748b' }}>
                        {new Date(test.deadline) > new Date() ? '진행중' : '종료'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 반별 단어장 관리 화면
if (currentView === 'classWordManagement' && isAdmin) {
  return (
    <div style={{
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      {/* 헤더 */}
      <div style={{
        background: 'transparent',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => setCurrentView('admin')}
          style={{
            background: 'white',
            border: '2px solid #e2e8f0',
            color: '#172f0b',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px'
          }}
        >
          ← 뒤로
        </button>
        <h1 style={{
          fontFamily: "'Gamja Flower', cursive",
          fontWeight: 700,
          fontSize: '1.3rem',
          margin: 0,
          color: '#172f0b',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Album size={24} strokeWidth={2.5} style={{ color: '#f59e0b' }} />
          반별 단어장 관리
        </h1>
        <div style={{ width: '70px' }}></div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px 24px',
        boxSizing: 'border-box'
      }}>
        {/* 교재단어장 엑셀 업로드 섹션 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          marginBottom: '16px',
          border: '2px solid rgba(251, 191, 36, 0.5)'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#172f0b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📚 교재단어장 배포
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
              엑셀 파일명 = 단어장 이름 (예: 3과.xlsx)
            </p>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0', lineHeight: '1.4' }}>
              📋 열 순서: 1열-영어 | 2열-한글뜻 | 3열-동의어(선택) | 4열-반의어(선택) | 5열-영영풀이(선택)
            </p>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
              📌 대상 반 선택
            </label>
            <select
              value={selectedUploadClassId}
              onChange={(e) => setSelectedUploadClassId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #fcd34d',
                borderRadius: '10px',
                fontSize: '0.9rem',
                background: 'white'
              }}
            >
              <option value="">-- 반을 선택하세요 --</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.className} ({cls.students?.length || 0}명)
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
              📄 엑셀 파일 업로드 (.xlsx, .xls)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              disabled={isExcelUploading || !selectedUploadClassId}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px dashed #fcd34d',
                borderRadius: '10px',
                background: selectedUploadClassId ? '#fffbeb' : '#f3f4f6',
                cursor: selectedUploadClassId ? 'pointer' : 'not-allowed'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '6px 0 0 0' }}>
              첫 번째 행: 헤더 (영어, 한글) | 두 번째 행부터: 단어 데이터
            </p>
          </div>

          {excelUploadStatus && (
            <div style={{
              background: isExcelUploading ? '#fef3c7' : '#d1fae5',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              whiteSpace: 'pre-line',
              border: isExcelUploading ? '2px solid #fcd34d' : '2px solid #6ee7b7'
            }}>
              {excelUploadStatus}
            </div>
          )}
        </div>

        {/* 반별 단어장 조회 및 관리 섹션 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          marginBottom: '16px',
          border: '2px solid rgba(14, 165, 233, 0.5)'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#172f0b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} strokeWidth={2.5} style={{ color: '#0ea5e9' }} />
            반별 단어장 조회
          </h2>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
              🔍 조회할 반 선택
            </label>
            <select
              value={selectedClassForBooks}
              onChange={(e) => {
                setSelectedClassForBooks(e.target.value);
                loadClassBooks(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #7dd3fc',
                borderRadius: '10px',
                fontSize: '0.9rem',
                background: 'white'
              }}
            >
              <option value="">-- 반을 선택하세요 --</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.className} ({cls.students?.length || 0}명)
                </option>
              ))}
            </select>
          </div>

          {isLoadingClassBooks && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
              📚 단어장 로딩 중...
            </div>
          )}

          {selectedClassForBooks && !isLoadingClassBooks && (
            <div>
              <div style={{
                background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '14px',
                border: '2px solid #7dd3fc'
              }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0369a1', margin: 0 }}>
                  📖 {classes.find(c => c.id === selectedClassForBooks)?.className || ''}의 교재단어장
                  <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: '#0ea5e9' }}>
                    ({classBooks.length}개)
                  </span>
                </p>
              </div>

              {classBooks.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '30px',
                  color: '#64748b',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e1'
                }}>
                  <p style={{ margin: 0, fontSize: '1rem' }}>📭 배포된 단어장이 없습니다</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>위에서 엑셀 파일을 업로드하여 단어장을 배포하세요</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {classBooks.map(book => (
                    <div
                      key={book.id}
                      style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '14px',
                        border: '2px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#fcd34d';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.3rem',
                          boxShadow: '0 2px 6px rgba(251, 191, 36, 0.3)'
                        }}>
                          {book.icon || '📖'}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: '0 0 4px 0' }}>
                            {book.name}
                          </h3>
                          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                            📝 {book.wordCount}개 단어
                            {book.studentCount && (
                              <span style={{ marginLeft: '8px' }}>
                                | 👥 {book.studentCount}/{book.totalStudents}명 배포
                              </span>
                            )}
                            {book.createdAt && (
                              <span style={{ marginLeft: '8px' }}>
                                | 📅 {new Date(book.createdAt).toLocaleDateString('ko-KR')}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteClassBook(book.name, selectedClassForBooks)}
                        style={{
                          padding: '8px 14px',
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: '2px solid #fca5a5',
                          borderRadius: '10px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fecaca';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fee2e2';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <Trash2 size={16} strokeWidth={2.5} />
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 반 관리 섹션 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          marginBottom: '16px',
          border: '2px solid rgba(226, 232, 240, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#172f0b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Album size={20} strokeWidth={2.5} style={{ color: '#0369a1' }} />
              반 관리 ({classes.length}개)
            </h2>
            <button
              onClick={() => setShowClassForm(!showClassForm)}
              style={{
                padding: '6px 12px',
                background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
                color: '#0369a1',
                border: '2px solid #0ea5e9',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ 새 반 만들기
            </button>
          </div>

          {showClassForm && (
            <div style={{
              background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '14px',
              border: '2px solid #7dd3fc'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createClass()}
                  placeholder="반 이름 입력 (예: 복자여고1)"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '2px solid #7dd3fc',
                    borderRadius: '10px',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  onClick={createClass}
                  style={{
                    padding: '10px 16px',
                    background: '#0ea5e9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  생성
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {classes.map(cls => (
              <div
                key={cls.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '14px',
                  border: '2px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Album size={20} strokeWidth={2.5} style={{ color: '#0369a1' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', margin: '0 0 2px 0' }}>
                      {cls.className}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                      👥 {cls.students?.length || 0}명
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 단어 관리 화면
if (currentView === 'wordManagement' && isAdmin) {
  const filteredWords = allWords.filter(word =>
    word.english?.toLowerCase().includes(wordSearchQuery.toLowerCase()) ||
    word.korean?.includes(wordSearchQuery)
  );

  return (
    <div style={{
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      {/* 헤더 */}
      <div style={{
        background: 'transparent',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => setCurrentView('admin')}
          style={{
            background: 'white',
            border: '2px solid #e2e8f0',
            color: '#172f0b',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px'
          }}
        >
          ← 뒤로
        </button>
        <h1 style={{
          fontFamily: "'Gamja Flower', cursive",
          fontWeight: 700,
          fontSize: '1.3rem',
          margin: 0,
          color: '#172f0b',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Book size={24} strokeWidth={2.5} style={{ color: '#0ea5e9' }} />
          단어 관리
        </h1>
        <div style={{ width: '70px' }}></div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px 24px',
        boxSizing: 'border-box'
      }}>
        {/* 단어 업로드 섹션 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          marginBottom: '16px',
          border: '2px solid rgba(226, 232, 240, 0.5)'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#172f0b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gift size={20} strokeWidth={2.5} style={{ color: '#0ea5e9' }} />
            단어 일괄 등록
          </h2>

          <div style={{ background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', padding: '12px', borderRadius: '10px', marginBottom: '14px', border: '2px solid #7dd3fc' }}>
            <div style={{ fontSize: '0.8rem', color: '#0369a1', marginBottom: '6px', fontWeight: '600' }}>
              📋 CSV 파일 형식:
            </div>
            <pre style={{
              background: 'white',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              overflow: 'auto',
              margin: 0,
              border: '2px solid #7dd3fc'
            }}>
{`english,korean
apple,사과
book,책`}
            </pre>
          </div>

          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            disabled={isUploading}
            style={{
              width: '100%',
              padding: '10px',
              border: '2px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          />

          {uploadStatus && (
            <div style={{
              padding: '10px 12px',
              background: isUploading ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
              border: `2px solid ${isUploading ? '#fcd34d' : '#6ee7b7'}`,
              borderRadius: '10px',
              fontSize: '0.85rem',
              color: isUploading ? '#b45309' : '#047857',
              fontWeight: '600'
            }}>
              {uploadStatus}
            </div>
          )}
        </div>

        {/* 단어 목록 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '2px solid rgba(226, 232, 240, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
              등록된 단어 ({allWords.length}개)
              {selectedWordIds.length > 0 && (
                <span style={{ color: '#0ea5e9', fontSize: '0.9rem', marginLeft: '8px' }}>
                  ({selectedWordIds.length}개 선택됨)
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedWordIds.length > 0 && (
                <button
                  onClick={bulkDeleteWords}
                  style={{
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={14} />
                  선택 삭제 ({selectedWordIds.length})
                </button>
              )}
              <button
                onClick={loadAllWords}
                style={{
                  padding: '6px 12px',
                  background: 'white',
                  color: '#475569',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔄 새로고침
              </button>
            </div>
          </div>

          {/* 검색창 */}
          <input
            type="text"
            value={wordSearchQuery}
            onChange={(e) => setWordSearchQuery(e.target.value)}
            placeholder="단어 검색 (영어 또는 한글)"
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '0.9rem',
              marginBottom: '12px'
            }}
          />

          {/* 전체 선택 버튼 */}
          {filteredWords.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={toggleAllWords}
                style={{
                  padding: '8px 16px',
                  background: selectedWordIds.length === filteredWords.length ? '#0ea5e9' : 'white',
                  color: selectedWordIds.length === filteredWords.length ? 'white' : '#0ea5e9',
                  border: '2px solid #0ea5e9',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle size={16} />
                {selectedWordIds.length === filteredWords.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
          )}

          {/* 단어 테이블 */}
          {filteredWords.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
              gap: '12px'
            }}>
              {filteredWords.map(word => (
                <div
                  key={word.id}
                  style={{
                    background: selectedWordIds.includes(word.id)
                      ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)'
                      : editingWord?.id === word.id
                        ? 'linear-gradient(135deg, #fef3c7, #fde68a)'
                        : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                    borderRadius: '12px',
                    padding: '14px',
                    border: `2px solid ${
                      selectedWordIds.includes(word.id)
                        ? '#0ea5e9'
                        : editingWord?.id === word.id
                          ? '#fcd34d'
                          : '#e2e8f0'
                    }`,
                    position: 'relative'
                  }}
                >
                  {/* 체크박스 */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    zIndex: 10
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedWordIds.includes(word.id)}
                      onChange={() => toggleWordSelection(word.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: '#0ea5e9'
                      }}
                    />
                  </div>

                  {editingWord?.id === word.id ? (
                    // 수정 모드
                    <div style={{ paddingRight: '30px' }}>
                      <input
                        type="text"
                        value={editingWord.english}
                        onChange={(e) => setEditingWord({ ...editingWord, english: e.target.value })}
                        placeholder="영어"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          marginBottom: '8px',
                          fontWeight: '600'
                        }}
                      />
                      <input
                        type="text"
                        value={editingWord.korean}
                        onChange={(e) => setEditingWord({ ...editingWord, korean: e.target.value })}
                        placeholder="한글 뜻"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          marginBottom: '8px'
                        }}
                      />
                      <textarea
                        value={editingWord.definition || ''}
                        onChange={(e) => setEditingWord({ ...editingWord, definition: e.target.value })}
                        placeholder="영영풀이 (선택)"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          marginBottom: '8px',
                          minHeight: '60px',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                      <input
                        type="text"
                        value={editingWord.synonyms || ''}
                        onChange={(e) => setEditingWord({ ...editingWord, synonyms: e.target.value })}
                        placeholder="동의어 (선택, 쉼표로 구분)"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          marginBottom: '8px'
                        }}
                      />
                      <input
                        type="text"
                        value={editingWord.antonyms || ''}
                        onChange={(e) => setEditingWord({ ...editingWord, antonyms: e.target.value })}
                        placeholder="반의어 (선택, 쉼표로 구분)"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          marginBottom: '12px'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => updateWord(editingWord.id, {
                            english: editingWord.english,
                            korean: editingWord.korean,
                            definition: editingWord.definition || '',
                            synonyms: editingWord.synonyms || '',
                            antonyms: editingWord.antonyms || ''
                          })}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: '#0ea5e9',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          ✓ 저장
                        </button>
                        <button
                          onClick={() => setEditingWord(null)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: 'white',
                            color: '#64748b',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 보기 모드
                    <div style={{ paddingRight: '30px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '1rem', fontWeight: '700', color: '#172f0b', marginBottom: '4px' }}>
                          {word.english}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '8px' }}>
                          {word.korean}
                        </div>

                        {/* 영영풀이 */}
                        {word.definition && (
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#475569',
                            padding: '8px',
                            background: 'rgba(255, 255, 255, 0.6)',
                            borderRadius: '6px',
                            marginBottom: '6px',
                            borderLeft: '3px solid #6366f1'
                          }}>
                            <div style={{ fontWeight: '600', color: '#6366f1', marginBottom: '2px' }}>📖 Definition</div>
                            {word.definition}
                          </div>
                        )}

                        {/* 동의어 */}
                        {word.synonyms && (
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#475569',
                            padding: '6px 8px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderRadius: '6px',
                            marginBottom: '4px'
                          }}>
                            <span style={{ fontWeight: '600', color: '#16a34a' }}>✓ 동의어:</span> {word.synonyms}
                          </div>
                        )}

                        {/* 반의어 */}
                        {word.antonyms && (
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#475569',
                            padding: '6px 8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '6px',
                            marginBottom: '4px'
                          }}>
                            <span style={{ fontWeight: '600', color: '#dc2626' }}>✗ 반의어:</span> {word.antonyms}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setEditingWord({ ...word })}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: 'white',
                            color: '#0ea5e9',
                            border: '2px solid #0ea5e9',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Edit2 size={14} />
                          수정
                        </button>
                        <button
                          onClick={() => deleteWordFromDB(word.id, word.english)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: 'white',
                            color: '#ef4444',
                            border: '2px solid #ef4444',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Trash2 size={14} />
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              color: '#64748b'
            }}>
              {wordSearchQuery ? '검색 결과가 없습니다' : '등록된 단어가 없습니다'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 중복 단어 통합 화면
if (currentView === 'duplicateMerge' && isAdmin) {
  // 중복 단어 찾기
  const duplicateGroups = {};
  allWords.forEach(word => {
    const key = word.english.toLowerCase().trim();
    if (!duplicateGroups[key]) {
      duplicateGroups[key] = [];
    }
    duplicateGroups[key].push(word);
  });

  // 2개 이상인 것만 필터링
  const duplicates = Object.entries(duplicateGroups)
    .filter(([_, words]) => words.length > 1)
    .sort((a, b) => b[1].length - a[1].length); // 많이 중복된 순서대로

  return (
    <div style={{
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      {/* 헤더 */}
      <div style={{
        background: 'transparent',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <button
          onClick={() => setCurrentView('admin')}
          style={{
            background: 'white',
            border: '2px solid #e2e8f0',
            color: '#172f0b',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '10px'
          }}
        >
          ← 관리자 페이지
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: '700', margin: 0, color: '#172f0b' }}>
          🔀 중복 단어 통합
        </h1>
        <div style={{ width: '100px' }}></div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px 24px',
        boxSizing: 'border-box'
      }}>
        {/* 안내 메시지 */}
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed, #fed7aa)',
          border: '2px solid #fb923c',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '0.95rem', color: '#9a3412', fontWeight: '600' }}>
            📋 중복된 단어 {duplicates.length}개 발견
          </div>
          <div style={{ fontSize: '0.85rem', color: '#c2410c', marginTop: '4px' }}>
            각 단어 그룹에서 남길 단어를 선택하고 나머지를 삭제하세요.
          </div>
        </div>

        {duplicates.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '48px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#172f0b', marginBottom: '8px' }}>
              중복된 단어가 없습니다!
            </div>
            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
              모든 단어가 고유합니다.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {duplicates.map(([english, words], index) => (
              <div
                key={english}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  border: '2px solid #e2e8f0'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '2px solid #f1f5f9'
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '1.3rem',
                      fontWeight: '700',
                      color: '#172f0b',
                      margin: 0
                    }}>
                      {words[0].english}
                    </h3>
                    <p style={{
                      fontSize: '0.85rem',
                      color: '#64748b',
                      margin: '4px 0 0 0'
                    }}>
                      {words.length}개의 중복
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`"${words[0].english}" 단어의 중복을 자동으로 정리하시겠습니까?\n첫 번째 단어만 남기고 나머지를 삭제합니다.`)) {
                        return;
                      }

                      try {
                        // 첫 번째 제외하고 나머지 삭제
                        for (let i = 1; i < words.length; i++) {
                          await deleteDoc(doc(db, 'dictionary', words[i].id));
                        }

                        alert('중복이 제거되었습니다!');
                        loadAllWords(); // 새로고침
                      } catch (error) {
                        console.error('중복 제거 오류:', error);
                        alert('오류가 발생했습니다.');
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    자동 정리
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  {words.map((word, idx) => (
                    <div
                      key={word.id}
                      style={{
                        background: idx === 0 ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)' : '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        border: idx === 0 ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                        position: 'relative'
                      }}
                    >
                      {idx === 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-10px',
                          right: '16px',
                          background: '#3b82f6',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}>
                          기본 유지
                        </div>
                      )}

                      <div style={{ marginBottom: '8px' }}>
                        <div style={{
                          fontSize: '1.1rem',
                          fontWeight: '700',
                          color: '#172f0b',
                          marginBottom: '4px'
                        }}>
                          {word.english}
                        </div>
                        {word.pronunciation && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                            {word.pronunciation}
                          </div>
                        )}
                        <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                          {word.korean}
                        </div>
                      </div>

                      {word.example && (
                        <div style={{
                          background: 'rgba(255,255,255,0.5)',
                          borderRadius: '8px',
                          padding: '8px',
                          fontSize: '0.8rem',
                          color: '#64748b',
                          marginTop: '8px'
                        }}>
                          예문: {word.example}
                        </div>
                      )}

                      {idx !== 0 && (
                        <button
                          onClick={async () => {
                            if (!confirm('이 단어를 삭제하시겠습니까?')) return;

                            try {
                              await deleteDoc(doc(db, 'dictionary', word.id));
                              alert('삭제되었습니다!');
                              loadAllWords();
                            } catch (error) {
                              console.error('삭제 오류:', error);
                              alert('삭제 중 오류가 발생했습니다.');
                            }
                          }}
                          style={{
                            marginTop: '12px',
                            width: '100%',
                            padding: '8px',
                            background: '#ef4444',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          이 중복 삭제
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

 // 단어장 상세 화면 (list)
if (currentView === 'list' && selectedBook) {
  return (
    <div style={{ 
      background: 'linear-gradient(to bottom right, #f5f9f3, #e8f3e5, #f0f5ee)', 
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

     <div style={{ 
        width: '100%', 
        maxWidth: '500px',    // 👈 추가!
        margin: '0 auto',      // 👈 추가!
        padding: '20px', 
        boxSizing: 'border-box' 
      }}>
        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => {
              setCurrentView('home');
              setSelectedBook(null);
            }}
            style={{
              background: 'white',
              border: '2px solid #e8f3e5',
              color: '#172f0b',
              padding: '5px 8px',
              borderRadius: '12px',
              fontSize: '0.7rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← 목록
          </button>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#172f0b',
            margin: 0
          }}>
            {selectedBook.name}
          </h1>
          <div style={{ width: '80px' }}></div>
        </div>

       {/* 학습 버튼들 */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '12px',
          marginBottom: '24px'
        }}>
          <button
            onClick={startFlashcard}
            disabled={currentBookWords.length === 0}
            style={{
              padding: '16px',
              background: currentBookWords.length === 0 ? '#e5e7eb' : '#bbf7d0',
              color: currentBookWords.length === 0 ? '#9ca3af' : '#166534',
              border: 'none',
              borderRadius: '16px',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: currentBookWords.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <BookOpen size={20} />
            플래시카드
          </button>
          <button
            onClick={() => setCurrentView('quizModeSelect')}
            disabled={currentBookWords.length === 0}
            style={{
              padding: '16px',
              background: currentBookWords.length === 0 ? '#e5e7eb' : 'linear-gradient(135deg, #bbf7d0, #86efac)',
              color: currentBookWords.length === 0 ? '#9ca3af' : '#166534',
              border: 'none',
              borderRadius: '16px',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: currentBookWords.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Brain size={20} />
            퀴즈
          </button>
        </div>

        {/* 단어 추가 버튼 */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            width: '100%',
            padding: '16px',
            background: 'white',
            border: '2px dashed #167c4c',
            borderRadius: '16px',
            color: '#167c4c',
            fontSize: '1rem',
            fontWeight: '700',
            cursor: 'pointer',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Plus size={20} />
          새 단어 추가
        </button>

        {/* 단어 추가 폼 */}
        {showAddForm && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px', color: '#172f0b' }}>
              ✏️ 새 단어 추가
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="영어 단어 (여러 개는 콤마로 구분: apple, banana, cherry)"
                value={newWord.english}
                onChange={(e) => setNewWord({ ...newWord, english: e.target.value })}
                style={{
                  padding: '12px',
                  border: '2px solid #e8f3e5',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                disabled={isLoadingTranslation}
              />
              
              {isLoadingTranslation && (
                <div style={{
                  padding: '12px',
                  background: '#f0f5ee',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: '0.9rem'
                }}>
                  🔍 단어 정보를 검색하고 있어요...
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={addWord}
                  disabled={!newWord.english || isLoadingTranslation}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: (!newWord.english || isLoadingTranslation) ? '#e5e7eb' : 'linear-gradient(135deg, #172f0b, #2d5a1a)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: (!newWord.english || isLoadingTranslation) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isLoadingTranslation ? '검색 중...' : '추가'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewWord({ english: '', korean: '', example: '', pronunciation: '' });
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#f0f5ee',
                    color: '#172f0b',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

       {/* 단어 목록 - 파스텔톤 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {currentBookWords.length === 0 ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              borderRadius: '14px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#64748b',
              border: '2px solid rgba(226, 232, 240, 0.5)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📚</div>
              <div style={{ fontSize: '1rem', marginBottom: '6px', fontWeight: '600' }}>아직 단어가 없어요</div>
              <div style={{ fontSize: '0.85rem' }}>위의 버튼을 눌러 단어를 추가해보세요!</div>
            </div>
          ) : (
            currentBookWords.map((word, index) => (
              <div
                key={word.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '14px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: word.mastered ? '2px solid #6ee7b7' : '2px solid rgba(226, 232, 240, 0.5)',
                  transition: 'all 0.2s'
                }}
              >
                {/* 헤더: 번호 + 단어 + 체크마크 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  {/* 번호 - 파스텔톤 */}
                  <div style={{
                    width: '28px',
                    height: '28px',
                    background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                    border: '2px solid #7dd3fc',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: '#0369a1',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>

                  {/* 단어 영역 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <h3 style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: '700', 
                        color: '#172f0b',
                        margin: 0
                      }}>
                        {word.english}
                      </h3>
                      <button
                        onClick={() => speakWord(word.english)}
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Volume2 size={16} color="#6d28d9" strokeWidth={2.5} />
                      </button>
                      
                      {/* 발음기호 */}
                      {word.pronunciation && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {word.pronunciation}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 체크마크 버튼 - 파스텔톤 */}
                  <button
                    onClick={() => toggleMastered(word.id)}
                    style={{
                      width: '34px',
                      height: '34px',
                      background: word.mastered 
                        ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' 
                        : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                      border: word.mastered ? '2px solid #6ee7b7' : '2px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                    }}
                  >
                    {word.mastered ? (
                      <Check size={18} strokeWidth={2.5} style={{ color: '#047857' }} />
                    ) : (
                      <Star size={18} strokeWidth={2.5} style={{ color: '#94a3b8' }} />
                    )}
                  </button>
                </div>

                {/* 뜻 영역 - 파스텔톤 */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                  border: '2px solid #d1fae5',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '10px'
                }}>
                  {editingWordId === word.id ? (
                    <input
                      type="text"
                      value={word.korean}
                      onChange={(e) => {
                        const updatedWords = words.map(w => 
                          w.id === word.id ? { ...w, korean: e.target.value } : w
                        );
                        setWords(updatedWords);
                      }}
                      style={{
                        fontSize: '0.95rem',
                        color: '#172f0b',
                        border: '2px solid #6ee7b7',
                        borderRadius: '8px',
                        padding: '8px',
                        width: '100%',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: '0.95rem', color: '#172f0b', fontWeight: '500' }}>
                      {word.korean}
                    </div>
                  )}
                </div>

                {/* 영영풀이/동의어/반의어 - 파스텔톤 */}
                {editingWordId === word.id ? (
                  <div style={{ marginBottom: '10px' }}>
                    {/* 영영풀이 편집 */}
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                        영영풀이 (Definition)
                      </label>
                      <textarea
                        value={word.definition || ''}
                        onChange={(e) => {
                          const updatedWords = words.map(w =>
                            w.id === word.id
                              ? { ...w, definition: e.target.value }
                              : w
                          );
                          setWords(updatedWords);
                        }}
                        placeholder="영어 뜻 설명을 입력하세요"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #c4b5fd',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          background: '#f5f3ff',
                          outline: 'none',
                          minHeight: '60px',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                    {/* 동의어 편집 */}
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                        동의어 (쉼표로 구분)
                      </label>
                      <input
                        type="text"
                        value={word.synonyms?.join(', ') || ''}
                        onChange={(e) => {
                          const updatedWords = words.map(w =>
                            w.id === word.id
                              ? { ...w, synonyms: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                              : w
                          );
                          setWords(updatedWords);
                        }}
                        placeholder="예: happy, joyful, glad"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #a7f3d0',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          background: '#ecfdf5',
                          outline: 'none'
                        }}
                      />
                    </div>
                    {/* 반의어 편집 */}
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                        반의어 (쉼표로 구분)
                      </label>
                      <input
                        type="text"
                        value={word.antonyms?.join(', ') || ''}
                        onChange={(e) => {
                          const updatedWords = words.map(w =>
                            w.id === word.id
                              ? { ...w, antonyms: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                              : w
                          );
                          setWords(updatedWords);
                        }}
                        placeholder="예: sad, unhappy, miserable"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #f9a8d4',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          background: '#fdf2f8',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* 영영풀이 표시 */}
                    {word.definition && (
                      <div style={{
                        marginBottom: '10px',
                        padding: '10px',
                        background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                        border: '2px solid #c4b5fd',
                        borderRadius: '8px'
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#6d28d9', fontWeight: '600', marginBottom: '4px' }}>
                          📖 Definition
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#172f0b', lineHeight: '1.4' }}>
                          {word.definition}
                        </div>
                      </div>
                    )}

                    {/* 동의어/반의어 표시 */}
                    {(word.synonyms?.length > 0 || word.antonyms?.length > 0) && (
                      <div style={{
                        marginBottom: '10px',
                        display: 'flex',
                        gap: '4px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}>
                      {/* 동의어 */}
                      {word.synonyms?.length > 0 && (
                        <>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600' }}>
                            동의어
                          </span>
                          {word.synonyms.slice(0, 3).map((syn, idx) => (
                            <button
                              key={idx}
                              onClick={() => addWordFromClick(syn)}
                              style={{
                                fontSize: '0.65rem',
                                background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                                color: '#047857',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid #6ee7b7',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit',
                                fontWeight: '600'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #a7f3d0, #6ee7b7)';
                                e.target.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
                                e.target.style.transform = 'scale(1)';
                              }}
                            >
                              {syn}
                            </button>
                          ))}
                        </>
                      )}

                      {/* 구분선 */}
                      {word.synonyms?.length > 0 && word.antonyms?.length > 0 && (
                        <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>|</span>
                      )}

                      {/* 반의어 */}
                      {word.antonyms?.length > 0 && (
                        <>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600' }}>
                            반의어
                          </span>
                          {word.antonyms.slice(0, 3).map((ant, idx) => (
                            <button
                              key={idx}
                              onClick={() => addWordFromClick(ant)}
                              style={{
                                fontSize: '0.65rem',
                                background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
                                color: '#be123c',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid #f9a8d4',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit',
                                fontWeight: '600'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #fbcfe8, #f9a8d4)';
                                e.target.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = 'linear-gradient(135deg, #fce7f3, #fbcfe8)';
                                e.target.style.transform = 'scale(1)';
                              }}
                            >
                              {ant}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                    )}
                  </div>
                )}

                {/* 버튼 영역 - 파스텔톤 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* 암기완료 버튼 */}
                  <button
                    onClick={() => markAsMastered(word.id)}
                    style={{
                      padding: '6px 12px',
                      background: 'linear-gradient(135deg, #99f6e4, #5eead4)',
                      border: '2px solid #2dd4bf',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      color: '#0d9488',
                      fontWeight: '700',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 8px rgba(45, 212, 191, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                    title="암기완료로 이동"
                  >
                    <CheckCircle size={14} strokeWidth={2.5} />
                    암기완료
                  </button>
                  
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {editingWordId === word.id ? (
                      <>
                        <button
                          onClick={() => {
                            saveUserData();
                            setEditingWordId(null);
                          }}
                          style={{
                            padding: '8px 12px',
                            background: 'linear-gradient(135deg, #6ee7b7, #34d399)',
                            border: '2px solid #10b981',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            fontSize: '0.75rem',
                            color: '#065f46',
                            fontWeight: '600'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          <Check size={14} strokeWidth={2.5} />
                          저장
                        </button>
                        <button
                          onClick={() => setEditingWordId(null)}
                          style={{
                            padding: '8px 12px',
                            background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
                            border: '2px solid #94a3b8',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            fontSize: '0.75rem',
                            color: '#475569',
                            fontWeight: '600'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 2px 8px rgba(148, 163, 184, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          <X size={14} strokeWidth={2.5} />
                          취소
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingWordId(word.id)}
                        style={{
                          padding: '8px 12px',
                          background: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)',
                          border: '2px solid #a78bfa',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'scale(1.05)';
                          e.target.style.boxShadow = '0 2px 8px rgba(167, 139, 250, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <Edit2 size={14} strokeWidth={2.5} style={{ color: '#6d28d9' }} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteWord(word.id)}
                      style={{
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #fecdd3, #fda4af)',
                        border: '2px solid #fb7185',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'scale(1.05)';
                        e.target.style.boxShadow = '0 2px 8px rgba(251, 113, 133, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      <Trash2 size={14} strokeWidth={2.5} style={{ color: '#be123c' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 암기 완료 화면
if (currentView === 'memorized') {
  const memorizedWords = words.filter(w => w.mastered === true);

  return (
   <div style={{ 
      background: 'linear-gradient(to bottom right, #f5f9f3, #e8f3e5, #f0f5ee)', 
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      <div style={{ 
        width: '100%', 
        maxWidth: '500px', 
        margin: '0 auto', 
        padding: '12px', 
        boxSizing: 'border-box' 
      }}>

        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => setCurrentView('home')}
            style={{
              background: 'white',
              border: '2px solid #e8f3e5',
              color: '#172f0b',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← 홈으로
          </button>
          <h1 style={{ 
            fontSize: '1.2rem', 
            fontWeight: '700', 
            color: '#172f0b',
            margin: 0
          }}>
            ✨ 암기 완료
          </h1>
          <div style={{ width: '60px' }}></div>
        </div>

        {/* 통계 카드 */}
        <div style={{
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '14px',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🎉</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '6px' }}>
            총 {memorizedWords.length}개 단어 암기 완료!
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            고생했어! 계속 화이팅!🔥
          </div>
        </div>

        {/* 암기 완료 단어 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {memorizedWords.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#888'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✨</div>
              <div style={{ fontSize: '1rem', marginBottom: '6px' }}>아직 암기 완료한 단어가 없어요</div>
              <div style={{ fontSize: '0.85rem' }}>단어를 학습하고 암기 완료 버튼을 눌러보세요!</div>
            </div>
          ) : (
            memorizedWords.map((word) => (
              <div
                key={word.id}
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: '2px solid #22c55e'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                  {/* 체크 아이콘 */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#22c55e',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Check size={18} color="white" />
                  </div>

                  {/* 단어 영역 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <h3 style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: '700', 
                        color: '#172f0b',
                        margin: 0
                      }}>
                        {word.english}
                      </h3>
                      <button
                        onClick={() => speakWord(word.english)}
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Volume2 size={18} color="#172f0b" />
                      </button>
                    </div>
                    
                    {word.pronunciation && (
                      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>
                        {word.pronunciation}
                      </div>
                    )}
                  </div>
                </div>

                {/* 뜻 */}
                <div style={{
                  background: '#f0fdf4',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '10px'
                }}>
                  <div style={{ fontSize: '0.9rem', color: '#444' }}>
                    {word.korean}
                  </div>
                </div>

                {/* 취소 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => toggleMastered(word.id)}
                    style={{
                      padding: '6px 12px',
                      background: '#f0f5ee',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    
                    다시 외우러 가기💪
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 오답노트 화면
if (currentView === 'wrongNote') {
  const wrongNoteWords = words.filter(w => w.wrongNote === true);

  // 검색 필터링
  const searchedWords = wrongNoteSearchQuery.trim()
    ? words.filter(w =>
        !w.wrongNote && (
          w.english.toLowerCase().includes(wrongNoteSearchQuery.toLowerCase()) ||
          w.korean.includes(wrongNoteSearchQuery)
        )
      )
    : [];

  return (
    <div style={{
      background: 'linear-gradient(to bottom right, #fef2f2, #fee2e2, #fef5f5)',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
        padding: '12px',
        boxSizing: 'border-box'
      }}>

        {/* 헤더 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => setCurrentView('home')}
            style={{
              background: 'white',
              border: '2px solid #fee2e2',
              color: '#7f1d1d',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← 홈으로
          </button>
          <h1 style={{
            fontSize: '1.2rem',
            fontWeight: '700',
            color: '#7f1d1d',
            margin: 0
          }}>
            📝 오답노트
          </h1>
          <div style={{ width: '60px' }}></div>
        </div>

        {/* 검색창 */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '14px',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)',
          border: '2px solid #fecaca'
        }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#7f1d1d', marginBottom: '10px' }}>
            🔍 단어 검색 & 추가
          </div>
          <input
            type="text"
            placeholder="틀린 단어를 검색하세요..."
            value={wrongNoteSearchQuery}
            onChange={(e) => setWrongNoteSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '2px solid #fecaca',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#ef4444'}
            onBlur={(e) => e.target.style.borderColor = '#fecaca'}
          />

          {/* 검색 결과 */}
          {searchedWords.length > 0 && (
            <div style={{ marginTop: '12px', maxHeight: '200px', overflowY: 'auto' }}>
              {searchedWords.slice(0, 5).map(word => (
                <div
                  key={word.id}
                  onClick={() => {
                    toggleWrongNote(word.id);
                    setWrongNoteSearchQuery('');
                  }}
                  style={{
                    padding: '10px',
                    background: '#fef2f2',
                    borderRadius: '8px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #fecaca',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.borderColor = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', color: '#7f1d1d' }}>{word.english}</div>
                    <div style={{ fontSize: '0.8rem', color: '#991b1b' }}>{word.korean}</div>
                  </div>
                  <div style={{ fontSize: '1.2rem' }}>+</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 통계 카드 */}
        <div style={{
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '14px',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📝</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '6px' }}>
            총 {wrongNoteWords.length}개 단어
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            틀린 단어를 복습하고 완벽하게 마스터하자!
          </div>
        </div>

        {/* 오답노트 단어 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {wrongNoteWords.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#888'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📝</div>
              <div style={{ fontSize: '1rem', marginBottom: '6px' }}>아직 등록된 단어가 없어요</div>
              <div style={{ fontSize: '0.85rem' }}>위 검색창에서 틀린 단어를 검색하고 추가해보세요!</div>
            </div>
          ) : (
            wrongNoteWords.map((word) => (
              <div
                key={word.id}
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: '2px solid #ef4444'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                  {/* X 아이콘 */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#ef4444',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <X size={18} color="white" />
                  </div>

                  {/* 단어 영역 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <h3 style={{
                        fontSize: '1.2rem',
                        fontWeight: '700',
                        color: '#7f1d1d',
                        margin: 0
                      }}>
                        {word.english}
                      </h3>
                      <button
                        onClick={() => speakWord(word.english)}
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Volume2 size={16} color="#7f1d1d" />
                      </button>
                    </div>
                    <p style={{
                      fontSize: '0.95rem',
                      color: '#991b1b',
                      margin: '0 0 10px 0'
                    }}>
                      {word.korean}
                    </p>

                    {/* 영영풀이 */}
                    {word.definition && (
                      <div style={{
                        background: '#fef2f2',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        border: '1px solid #fecaca'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: '600', marginBottom: '4px' }}>영영풀이</div>
                        <div style={{ fontSize: '0.8rem', color: '#7f1d1d', lineHeight: '1.4' }}>{word.definition}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 제거 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => toggleWrongNote(word.id)}
                    style={{
                      padding: '6px 12px',
                      background: '#fef2f2',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    제거
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 플래시카드 화면 - 겨울 파스텔 테마
if (currentView === 'flashcard') {
  const currentWord = currentBookWords[currentCardIndex];
  
  if (!currentWord) {
    return (
      <div style={{ 
        background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)', 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
          <div style={{ fontSize: '1.2rem', color: '#172f0b', marginBottom: '16px' }}>
            단어가 없습니다
          </div>
          <button
            onClick={() => setCurrentView('list')}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)', 
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      <div style={{ 
        width: '100%', 
        maxWidth: '500px',    
        margin: '0 auto',       
        padding: '12px',        
        boxSizing: 'border-box' 
      }}>

        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setCurrentView('list')}
            style={{
              background: 'white',
              border: '2px solid #e2e8f0',
              color: '#172f0b',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← 돌아가기
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
              플래시카드
            </h1>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
              {currentCardIndex + 1} / {quizWords.length}
            </div>
          </div>
          <div style={{ width: '80px' }}></div>
        </div>

        {/* 플래시카드 */}
        <div
          onClick={() => setShowAnswer(!showAnswer)}
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            padding: '40px 24px',
            minHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            marginBottom: '20px',
            transition: 'transform 0.2s',
            border: '2px solid #6ee7b7'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#172f0b', marginBottom: '12px', textAlign: 'center' }}>
            {currentWord.english}
          </div>
          
          {currentWord.pronunciation && (
            <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '20px' }}>
              {currentWord.pronunciation}
            </div>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              speakWord(currentWord.english);
            }}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
              border: '2px solid #6ee7b7',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '24px',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#047857'
            }}
          >
            <Volume2 size={18} strokeWidth={2.5} />
            발음 듣기
          </button>

          {showAnswer ? (
            <div style={{ width: '100%' }}>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: '600',
                color: '#059669',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                padding: '16px 24px',
                borderRadius: '12px',
                border: '2px solid #6ee7b7',
                marginBottom: '16px'
              }}>
                {currentWord.korean}
              </div>

              {/* 영영풀이 */}
              {currentWord.definition && (
                <div style={{
                  fontSize: '0.85rem',
                  color: '#475569',
                  background: 'rgba(241, 245, 249, 0.8)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginBottom: '12px',
                  lineHeight: '1.5',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontWeight: '700', color: '#334155', marginBottom: '4px' }}>📖 Definition</div>
                  {currentWord.definition}
                </div>
              )}

              {/* 동의어 */}
              {currentWord.synonyms && currentWord.synonyms.length > 0 && (
                <div style={{
                  fontSize: '0.85rem',
                  color: '#0369a1',
                  background: 'rgba(224, 242, 254, 0.8)',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  marginBottom: '8px',
                  border: '1px solid #bae6fd'
                }}>
                  <span style={{ fontWeight: '700' }}>🔄 동의어:</span> {currentWord.synonyms.join(', ')}
                </div>
              )}

              {/* 반의어 */}
              {currentWord.antonyms && currentWord.antonyms.length > 0 && (
                <div style={{
                  fontSize: '0.85rem',
                  color: '#be123c',
                  background: 'rgba(254, 242, 242, 0.8)',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #fecaca'
                }}>
                  <span style={{ fontWeight: '700' }}>↔️ 반의어:</span> {currentWord.antonyms.join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center' }}>
              카드를 탭해서 답을 확인하세요
            </div>
          )}
        </div>

        {/* 네비게이션 버튼 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <button
            onClick={prevCard}
            style={{
              padding: '14px',
              background: 'white',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              color: '#475569',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← 이전퀴
          </button>
          <button
            onClick={nextCard}
            style={{
              padding: '14px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
            }}
          >
            다음 →
          </button>
        </div>
      </div>
    </div>
  );
}

// 퀴즈 화면 - 겨울 파스텔 테마
if (currentView === 'quiz') {
  const currentWord = quizWords[currentCardIndex];

  if (!currentWord) {
    return (
      <div style={{
        background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
          <div style={{ fontSize: '1.2rem', color: '#172f0b', marginBottom: '16px' }}>
            단어가 없습니다
          </div>
          <button
            onClick={() => setCurrentView('home')}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)', 
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
      `}</style>

      <div style={{ 
        width: '100%', 
        maxWidth: '500px', 
        margin: '0 auto', 
        padding: '12px', 
        boxSizing: 'border-box' 
      }}>
        {/* 헤더 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setCurrentView('home')}
            style={{
              background: 'white',
              border: '2px solid #e2e8f0',
              color: '#172f0b',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← 돌아가기
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#172f0b', margin: 0 }}>
              퀴즈
            </h1>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
              {currentCardIndex + 1} / {quizWords.length}
            </div>
          </div>
          <div style={{ 
            background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
            padding: '6px 12px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: '700',
            color: '#0369a1',
            border: '2px solid #7dd3fc'
          }}>
            {score.correct}/{score.total}
          </div>
        </div>

        {/* 문제 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '2px solid rgba(226, 232, 240, 0.5)'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#172f0b', marginBottom: '20px', textAlign: 'center' }}>
            {quizMode === 'spelling' ? currentWord.korean : (quizDirection === 'en-ko' ? currentWord.english : currentWord.korean)}
          </div>

          {quizMode === 'listening' && quizDirection === 'en-ko' && (
            <button
              onClick={() => speakWord(currentWord.english)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                border: '2px solid #fcd34d',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '20px',
                fontSize: '0.95rem',
                fontWeight: '600',
                color: '#b45309'
              }}
            >
              <Volume2 size={18} strokeWidth={2.5} />
              다시 듣기
            </button>
          )}

          {/* 객관식 */}
          {quizMode === 'multiple' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {multipleChoices.map((choice, index) => {
                const answer = quizDirection === 'en-ko' ? choice.korean : choice.english;
                const isSelected = quizAnswer === answer;
                const correctAnswer = quizDirection === 'en-ko' ? currentWord.korean : currentWord.english;
                const isCorrect = answer === correctAnswer;
                
                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (quizResult === null) {
                        setQuizAnswer(answer);
                      }
                    }}
                    disabled={quizResult !== null}
                    style={{
                      padding: '14px',
                      background: quizResult !== null 
                        ? (isCorrect ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' : isSelected ? 'linear-gradient(135deg, #fce7f3, #fbcfe8)' : 'white')
                        : (isSelected ? 'linear-gradient(135deg, #99f6e4, #5eead4)' : 'white'),
                      border: `2px solid ${quizResult !== null ? (isCorrect ? '#6ee7b7' : isSelected ? '#f9a8d4' : '#e2e8f0') : (isSelected ? '#2dd4bf' : '#e2e8f0')}`,
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: quizResult !== null ? (isCorrect ? '#047857' : isSelected ? '#be123c' : '#475569') : (isSelected ? '#0d9488' : '#475569'),
                      cursor: quizResult !== null ? 'default' : 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                  >
                    {answer}
                  </button>
                );
              })}
            </div>
          )}

          {/* 주관식 / 듣고 쓰기 */}
          {(quizMode === 'typing' || quizMode === 'listening') && (
            <input
              type="text"
              value={quizAnswer}
              onChange={(e) => setQuizAnswer(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && quizResult === null && checkAnswer()}
              placeholder="답을 입력하세요"
              disabled={quizResult !== null}
              style={{
                width: '100%',
                padding: '14px',
                border: `2px solid ${quizResult !== null ? (quizResult ? '#6ee7b7' : '#f9a8d4') : '#e2e8f0'}`,
                borderRadius: '10px',
                fontSize: '1rem',
                outline: 'none',
                background: quizResult !== null ? (quizResult ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' : 'linear-gradient(135deg, #fce7f3, #fbcfe8)') : 'white',
                boxSizing: 'border-box',
                fontWeight: '600',
                color: quizResult !== null ? (quizResult ? '#047857' : '#be123c') : '#172f0b'
              }}
              autoFocus
            />
          )}

          {/* 철자 맞추기 */}
          {quizMode === 'spelling' && (
            <div>
              {/* 선택된 철자 영역 (답안) */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '20px',
                minHeight: '60px',
                padding: '14px',
                background: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)',
                borderRadius: '10px',
                border: '2px solid #a78bfa'
              }}>
                {selectedLetters.length === 0 ? (
                  <div style={{
                    width: '100%',
                    textAlign: 'center',
                    color: '#9333ea',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>
                    철자를 클릭하여 단어를 완성하세요
                  </div>
                ) : (
                  selectedLetters.map((letter, index) => (
                    <button
                      key={`selected-${index}`}
                      onClick={() => {
                        if (quizResult === null) {
                          // 선택된 철자를 다시 제거
                          setSelectedLetters(selectedLetters.filter((_, i) => i !== index));
                        }
                      }}
                      disabled={quizResult !== null}
                      style={{
                        padding: '10px 14px',
                        background: 'white',
                        borderRadius: '8px',
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#6d28d9',
                        border: '2px solid #a78bfa',
                        cursor: quizResult === null ? 'pointer' : 'default',
                        transition: 'all 0.2s'
                      }}
                    >
                      {letter}
                    </button>
                  ))
                )}
              </div>

              {/* 선택 가능한 철자 버튼들 */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '10px',
                justifyContent: 'center'
              }}>
                {spellingInput.map((letter, index) => {
                  // 이미 선택된 철자인지 확인 (첫 번째로 나타나는 것만)
                  const selectedIndex = selectedLetters.indexOf(letter);
                  const isUsed = selectedIndex !== -1 && selectedLetters.slice(0, selectedIndex + 1).filter(l => l === letter).length > spellingInput.slice(0, index + 1).filter(l => l === letter).length;

                  return (
                    <button
                      key={`available-${index}`}
                      onClick={() => {
                        if (quizResult === null) {
                          // 철자를 선택 영역에 추가
                          setSelectedLetters([...selectedLetters, letter]);
                        }
                      }}
                      disabled={quizResult !== null || isUsed}
                      style={{
                        padding: '10px 14px',
                        background: isUsed ? '#f3f4f6' : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                        borderRadius: '8px',
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: isUsed ? '#9ca3af' : '#92400e',
                        border: `2px solid ${isUsed ? '#e5e7eb' : '#f59e0b'}`,
                        cursor: (quizResult === null && !isUsed) ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                        opacity: isUsed ? 0.4 : 1
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                아래 철자를 클릭하여 단어를 완성하세요. 선택한 철자를 다시 클릭하면 취소됩니다.
              </div>
            </div>
          )}

          {/* 결과 메시지 */}
          {quizResult !== null && (
            <div style={{
              marginTop: '20px',
              padding: '14px',
              background: quizResult ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' : 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
              borderRadius: '10px',
              textAlign: 'center',
              fontSize: '0.95rem',
              fontWeight: '600',
              color: quizResult ? '#047857' : '#be123c',
              border: `2px solid ${quizResult ? '#6ee7b7' : '#f9a8d4'}`
            }}>
              {quizResult ? '🎉 정답입니다!' : `❌ 틀렸어요. 정답은 "${quizDirection === 'en-ko' ? currentWord.korean : currentWord.english}" 입니다.`}
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {quizResult === null ? (
            <button
              onClick={checkAnswer}
              disabled={quizMode === 'spelling' ? selectedLetters.length === 0 : !quizAnswer}
              style={{
                flex: 1,
                padding: '14px',
                background: (quizMode === 'spelling' ? selectedLetters.length === 0 : !quizAnswer) ? '#e2e8f0' : 'linear-gradient(135deg, #99f6e4, #5eead4)',
                color: (quizMode === 'spelling' ? selectedLetters.length === 0 : !quizAnswer) ? '#94a3b8' : '#0d9488',
                border: (quizMode === 'spelling' ? selectedLetters.length === 0 : !quizAnswer) ? '2px solid #e2e8f0' : '2px solid #2dd4bf',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: (quizMode === 'spelling' ? selectedLetters.length === 0 : !quizAnswer) ? 'not-allowed' : 'pointer'
              }}
            >
              확인
            </button>
          ) : (
            <button
              onClick={nextQuiz}
              style={{
                flex: 1,
                padding: '14px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              {currentCardIndex < quizWords.length - 1 ? '다음 문제 →' : '완료'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 퀴즈 결과 화면
if (currentView === 'quizResults' && quizResults) {
  return (
    <div style={{
      background: 'linear-gradient(to bottom right, #f1f5f9, #fafaf9, #ecfdf5)',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');
        @font-face {
          font-family: 'Locus_sangsang';
          src: url('/locus_sangsang.ttf') format('truetype');
        }
        * { font-family: 'Locus_sangsang', sans-serif; box-sizing: border-box; }
        @keyframes celebrate {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-5deg); }
          75% { transform: scale(1.1) rotate(5deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .result-card {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>

      <div className="result-card" style={{
        width: '90%',
        maxWidth: '500px',
        background: 'white',
        borderRadius: '24px',
        padding: '48px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        textAlign: 'center'
      }}>
        {/* 축하 아이콘 */}
        <div style={{
          fontSize: '5rem',
          marginBottom: '24px',
          animation: 'celebrate 1.5s ease-in-out infinite'
        }}>
          {quizResults.percentage >= 90 ? '🎉' : quizResults.percentage >= 70 ? '💪' : '📚'}
        </div>

        {/* 제목 */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '800',
          color: '#172f0b',
          marginBottom: '12px'
        }}>
          {quizResults.percentage >= 90 ? '시험 통과!' : '수고했어요!'}
        </h1>

        {/* 메시지 */}
        <p style={{
          fontSize: '1rem',
          color: '#64748b',
          marginBottom: '16px'
        }}>
          {quizResults.percentage >= 90
            ? '완벽해요! 시험을 통과했습니다! 🌟'
            : '열심히 했지만 조금 더 노력이 필요해요!'}
        </p>

        {/* 90% 미만일 때 재시험 안내 */}
        {quizResults.percentage < 90 && (
          <div style={{
            background: '#fff7ed',
            border: '2px solid #f97316',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              fontSize: '0.95rem',
              color: '#ea580c',
              fontWeight: '600'
            }}>
              ⚠️ 시험 통과 기준: 90% 이상
            </div>
            <div style={{
              fontSize: '0.85rem',
              color: '#9a3412',
              marginTop: '8px'
            }}>
              재시험을 통해 다시 도전해보세요!
            </div>
          </div>
        )}

        {/* 점수 표시 */}
        <div style={{
          background: quizResults.percentage >= 90
            ? 'linear-gradient(135deg, #fef3c7, #fde68a)'
            : quizResults.percentage >= 70
            ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)'
            : 'linear-gradient(135deg, #fee2e2, #fecaca)',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '32px'
        }}>
          <div style={{
            fontSize: '3.5rem',
            fontWeight: '900',
            color: '#172f0b',
            marginBottom: '8px'
          }}>
            {quizResults.percentage}%
          </div>
          <div style={{
            fontSize: '1.2rem',
            color: '#475569',
            fontWeight: '600'
          }}>
            {quizResults.correct} / {quizResults.total} 정답
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
          {quizResults.percentage < 90 && currentTest && (
            <button
              onClick={async () => {
                // 재시험 시작
                try {
                  const testWords = [];
                  for (const wordId of currentTest.wordIds) {
                    const wordDoc = await getDoc(doc(db, 'dictionary', wordId));
                    if (wordDoc.exists()) {
                      testWords.push({ id: wordDoc.id, ...wordDoc.data() });
                    }
                  }

                  if (testWords.length === 0) {
                    alert('시험 단어를 불러올 수 없습니다.');
                    return;
                  }

                  const shuffledWords = [...testWords].sort(() => Math.random() - 0.5);
                  setQuizWords(shuffledWords);
                  setQuizMode('typing');
                  setQuizDirection('en-ko');
                  setCurrentCardIndex(0);
                  setQuizAnswer('');
                  setQuizResult(null);
                  setScore({ correct: 0, total: 0 });
                  setQuizResults(null);
                  setCurrentView('quiz');
                } catch (error) {
                  console.error('재시험 시작 오류:', error);
                  alert('재시험을 시작할 수 없습니다.');
                }
              }}
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: '700',
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              🔄 재시험 보기
            </button>
          )}

          <button
            onClick={() => {
              setQuizResults(null);
              setCurrentView('home');
            }}
            style={{
              width: '100%',
              padding: '16px',
              background: quizResults.percentage >= 90
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #64748b, #475569)',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: '700',
              color: 'white',
              cursor: 'pointer',
              boxShadow: quizResults.percentage >= 90
                ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                : '0 4px 12px rgba(100, 116, 139, 0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

return null;
}

