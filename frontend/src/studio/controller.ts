/**
 * PowerPointBD v2 Main Application Controller
 * Handles the 8-Screen Flow, TipTap Formatting, .docx + Bijoy conversion,
 * Server-Side AI calls, Real PPTX/PDF generation, and Admin Dashboard.
 */

import { initThreeBackground } from './three-background.ts';
import { animateNumber, animateScreenEnter, staggerEntrance, buttonRipple, shakeElement } from './motion-helper.ts';
import { convertBijoyToUnicode, isBijoy } from './bijoy-converter.ts';
import { exportToPptx, exportToPdf, type SlideData } from './deck-exporter.ts';
import mammoth from 'mammoth';

export type ScreenId = 'landing' | 'topic' | 'count' | 'preview' | 'payment' | 'deck' | 'profile' | 'admin';

interface AppState {
  currentScreen: ScreenId;
  orderId: string;
  topic: string;
  description: string;
  slideCount: number;
  wordCount: number;
  images: string[];
  regeneratesUsed: number;
  paymentStatus: 'none' | 'pending_verification' | 'verified' | 'rejected' | 'ready';
  trxId: string;
  slides: SlideData[];
  designSpec: any;
  user: { email: string; name: string } | null;
  adminTab: 'overview' | 'payments' | 'usage' | 'instructions' | 'ai' | 'pricing';
  chatHistory: { role: 'user' | 'assistant'; text: string; version?: string }[];
}

export function mountStudio() {
  const state: AppState = {
    currentScreen: 'landing',
    orderId: `order_${Date.now()}`,
    topic: 'Climate Change and Bangladesh',
    description: `Introduction\nবাংলাদেশে টেকসই জ্বালানি ও পরিবেশের রূপান্তর — সমুদ্রপৃষ্ঠের উচ্চতা, লবণাক্ততা এবং পরিবেশগত পরিবর্তন মোকাবিলায় প্রযুক্তি।\n\nImpact on Agriculture & Economy\n• উপকূলীয় অঞ্চলে কৃষি ও খাদ্য নিরাপত্তায় অভিযোজন\n• কৃষকদের পেশা পরিবর্তন ও বিকল্প কর্মসংস্থান\n• আধুনিক নবায়নযোগ্য সৌর ও বায়ু শক্তির অপার সম্ভাবনা\n\nAdaptation Strategies\nস্থানীয় জ্ঞান ও আধুনিক প্রযুক্তির সমন্বয়ে দুর্যোগ ব্যবস্থাপনা।`,
    slideCount: 12,
    wordCount: 52,
    images: [],
    regeneratesUsed: 0,
    paymentStatus: 'none',
    trxId: '',
    slides: [],
    designSpec: null,
    user: { email: 'student@example.com', name: 'Rahim' },
    adminTab: 'overview',
    chatHistory: [
      { role: 'assistant', text: 'তোমার ১২ স্লাইড রেডি। কোনো স্লাইডে তথ্য বা লেখা বদলাতে চাইলে স্লাইড নম্বর সহ বলো।' },
      { role: 'user', text: 'স্লাইড ৫ এ ঘূর্ণিঝড়ের সাথে "সিডর ২০০৭" উদাহরণ যোগ করো' },
      { role: 'assistant', text: 'করা হয়েছে। স্লাইড ৫-এর টাইমলাইনে "সিডর (২০০৭)" যোগ করেছি, বাকি ডিজাইন একই আছে।', version: 'স্লাইড ৫ আপডেট · v2' }
    ],
  };

  const appRoot = document.getElementById('app-root') || document.body;

  // Initialize Three.js 3D Background if canvas element exists
  const threeCanvasWrap = document.getElementById('three-bg-canvas');
  if (threeCanvasWrap) {
    try {
      initThreeBackground(threeCanvasWrap);
    } catch (e) {
      console.warn('Three.js canvas init deferred:', e);
    }
  }

  // Initial seed slides
  state.slides = [
    { n: 1, layout: 'title', title: state.topic, subtitle: 'AN OVERVIEW · PowerPointBD AI Design', notes: 'ভূমিকা ও প্রারম্ভিক উপস্থাপনা' },
    { n: 2, layout: 'bullets-with-icons', title: 'মূল চ্যালেঞ্জ ও বর্তমান প্রেক্ষাপট', bullet_points: ['জলবায়ু পরিবর্তনের ধারাবাহিক প্রভাব', 'কৃষি জমিতে লবণাক্ততা বৃদ্ধি', 'প্রাকৃতিক দুর্যোগের হার বৃদ্ধি', 'উপকূলীয় জনগোষ্ঠীর অভিযোজন'], notes: 'মূল পয়েন্টগুলো পর্যালোচনা' },
    { n: 3, layout: 'timeline', title: 'প্রধান দুর্যোগ ও ক্লাইমেট টাইমলাইন', items: [{ year: '১৯৭০', text: 'ভোলা ঘূর্ণিঝড়' }, { year: '১৯৯১', text: 'উপকূলীয় সাইক্লোন' }, { year: '২০০৭', text: 'সিডর (২০০৭) ও উদ্ধার কার্যক্রম' }, { year: '২০২০', text: 'আম্ফান ও উপকূল রক্ষা বাঁধ' }], notes: 'দুর্যোগের ঐতিহাসিক প্রেক্ষাপট' },
    { n: 4, layout: 'stat-hero', title: 'প্রভাবিত জনগোষ্ঠী ও পরিসংখ্যান', stats: [{ value: '৩০%', label: 'উপকূলীয় ফসলি জমি ঝুঁকিতে' }, { value: '২.৫x', label: 'ঘূর্ণিঝড়ের পুনরাবৃত্তি' }, { value: '১০M+', label: 'ক্ষতিগ্রস্ত উপকূলীয় মানুষ' }], notes: 'গবেষণামূলক পরিসংখ্যান' }
  ];

  function navigate(screen: ScreenId) {
    state.currentScreen = screen;
    window.location.hash = screen === 'landing' ? '' : `#${screen}`;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Handle browser back/forward buttons
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') as ScreenId;
    if (['landing', 'topic', 'count', 'preview', 'payment', 'deck', 'profile', 'admin'].includes(hash)) {
      if (state.currentScreen !== hash) {
        state.currentScreen = hash;
        render();
      }
    } else if (!window.location.hash) {
      if (state.currentScreen !== 'landing') {
        state.currentScreen = 'landing';
        render();
      }
    }
  });

  // Calculate live word count
  function getWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function render() {
    let html = '';

    // Header & device banner
    html += `
      <div class="device-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span>Windows বা Android ডিভাইস থেকে ব্যবহার রিকমেন্ডেড</span>
      </div>

      <header class="topbar">
        <div style="max-width:1180px;margin:0 auto;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <a href="#" class="brand" id="brand-link" style="display:flex;align-items:center;gap:10px;text-decoration:none">
            <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true" style="flex:none">
              <rect x="2" y="6" width="32" height="24" rx="5" fill="#006A4E"></rect>
              <circle cx="17" cy="18" r="6" fill="#C8102E"></circle>
            </svg>
            <span style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:22px;letter-spacing:-0.01em;color:#11140F">PowerPointBD</span>
          </a>

          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <button type="button" id="btn-my-presentations" class="secondary" style="padding:7px 16px;font-size:14px;border-radius:999px">আমার প্রেজেন্টেশন</button>
            <button type="button" id="btn-nav-admin" style="padding:7px 14px;font-size:13px;border-radius:999px;background:#F1EFEA;border:1px solid #DAD6C9">Admin</button>
            <div style="display:flex;border:1px solid #CFCABB;border-radius:999px;padding:2px;font-size:13px;font-weight:600;background:#FFFFFF">
              <span style="padding:4px 10px;border-radius:999px;background:#11140F;color:#F6F4EE">বাংলা</span>
              <span style="padding:4px 10px;border-radius:999px;color:#4A5148">EN</span>
            </div>
            ${state.user ? `
              <button type="button" id="btn-user-avatar" style="width:38px;height:38px;border-radius:50%;background:#006A4E;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:700;border:none;cursor:pointer" title="${state.user.email}">
                ${state.user.name[0]}
              </button>
            ` : `
              <button type="button" id="btn-login" class="primary" style="padding:7px 18px;font-size:14px">লগইন</button>
            `}
          </div>
        </div>
      </header>
    `;

    // Screen-specific contents
    if (state.currentScreen === 'landing') {
      html += renderScreen1();
    } else if (state.currentScreen === 'topic') {
      html += renderScreen2();
    } else if (state.currentScreen === 'count') {
      html += renderScreen3();
    } else if (state.currentScreen === 'preview') {
      html += renderScreen4();
    } else if (state.currentScreen === 'payment') {
      html += renderScreen5();
    } else if (state.currentScreen === 'deck') {
      html += renderScreen6();
    } else if (state.currentScreen === 'profile') {
      html += renderScreen7();
    } else if (state.currentScreen === 'admin') {
      html += renderScreen8();
    }

    appRoot.innerHTML = html;
    attachEvents();
    staggerEntrance('.screen-card, .faq-item, .how-step');
  }

  // SCREEN 1: LANDING
  function renderScreen1(): string {
    return `
      <main style="max-width:1180px;margin:0 auto;padding:40px 20px 80px">
        <!-- HERO -->
        <section style="display:flex;flex-wrap:wrap;align-items:center;gap:48px;padding:20px 0 60px">
          <div style="flex:1 1 480px;min-width:0">
            <div style="display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#006A4E;background:#E3EEE8;padding:6px 14px;border-radius:999px;margin-bottom:20px">
              <span style="width:8px;height:8px;border-radius:50%;background:#C8102E;display:inline-block"></span>
              টেমপ্লেট নয়, কাস্টম ডিজাইন
            </div>

            <h1 style="font-family:'Hind Siliguri','Bricolage Grotesque',sans-serif;font-weight:700;font-size:clamp(36px,5vw,62px);line-height:1.1;letter-spacing:-0.025em;margin:0 0 20px;color:#11140F">
              তোমার প্রেজেন্টেশন,<br>
              ডিজাইন সহ রেডি —<br>
              <span style="color:#006A4E">কয়েক মিনিটে।</span>
            </h1>

            <p style="font-size:19px;color:#4A5148;margin:0 0 28px;max-width:540px;line-height:1.55">
              টপিক আর ডেসক্রিপশন দাও। AI তোমার বিষয় বুঝে নিজেই কালার, লেআউট আর ইনফোগ্রাফিক ঠিক করবে। টেমপ্লেট নয়, প্রতিটা ডেক আলাদা। <span style="font-size:15px;color:#7A8278">Turn your idea into a clear story.</span>
            </p>

            <!-- ৳32 Card -->
            <div style="background:#FFFFFF;border:1.5px solid #DAD6C9;border-radius:18px;padding:18px 24px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between;max-width:440px;box-shadow:0 8px 24px -12px rgba(17,20,15,0.1)">
              <div>
                <span style="font-size:13px;color:#7A8278;display:block;font-weight:600">প্রতি স্লাইড</span>
                <strong style="font-size:38px;font-weight:800;color:#0B2B21;font-family:'Bricolage Grotesque',sans-serif">৳৩২</strong>
              </div>
              <div style="text-align:right">
                <span style="display:block;font-size:13.5px;font-weight:600;color:#11140F">পেমেন্টের আগেই দাম দেখবে</span>
                <span style="display:inline-block;background:#E3EEE8;color:#006A4E;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-top:4px">৪টি স্লাইড ফ্রি প্রিভিউ</span>
              </div>
            </div>

            <div>
              <button type="button" id="btn-hero-cta" class="primary" style="font-size:18px;font-weight:700;padding:14px 34px;border-radius:999px;display:inline-flex;align-items:center;gap:10px;box-shadow:0 6px 20px rgba(0,106,78,0.25)">
                প্রেজেন্টেশন বানাও →
              </button>
            </div>
          </div>

          <!-- Interactive 3D Showcase Card -->
          <div style="flex:1 1 420px;min-width:0;position:relative">
            <div style="aspect-ratio:16/9;background:#0B2B21;border-radius:20px;padding:24px;color:#F6F4EE;box-shadow:0 24px 50px -20px rgba(11,43,33,0.5);display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7FE0BC;font-weight:700">AI Live Showcase</span>
                <span style="background:rgba(200,16,46,0.2);color:#FF6B81;border:1px solid rgba(200,16,46,0.4);font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700">Custom Native PPTX</span>
              </div>
              <div>
                <h3 style="font-size:24px;margin:0 0 8px;font-weight:700;color:#FFFFFF">Climate Change and Bangladesh</h3>
                <p style="font-size:14px;color:#B8C4BC;margin:0">উপকূলীয় কৃষি, সমুদ্রপৃষ্ঠের উচ্চতা ও নবায়নযোগ্য শক্তি</p>
              </div>
              <div style="display:flex;gap:8px">
                <span style="height:6px;width:40px;border-radius:3px;background:#7FE0BC"></span>
                <span style="height:6px;width:24px;border-radius:3px;background:#164637"></span>
                <span style="height:6px;width:24px;border-radius:3px;background:#164637"></span>
              </div>
            </div>
          </div>
        </section>

        <!-- 3 STEPS -->
        <section style="margin:60px 0">
          <h2 style="font-size:28px;font-weight:700;margin-bottom:24px;color:#11140F">যেভাবে কাজ করে</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px">
            <div class="how-step" style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:18px;padding:24px;box-shadow:0 4px 12px rgba(17,20,15,0.05)">
              <div style="width:40px;height:40px;border-radius:50%;background:#006A4E;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;margin-bottom:16px">১</div>
              <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">টপিক আর ডেসক্রিপশন লেখো</h3>
              <p style="font-size:15px;color:#4A5148;margin:0">টপিক আর বিস্তারিত ডেসক্রিপশন দাও (ছবি সহ যদি থাকে) অথবা ওয়ার্ড .docx ফাইল আপলোড করো।</p>
            </div>

            <div class="how-step" style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:18px;padding:24px;box-shadow:0 4px 12px rgba(17,20,15,0.05)">
              <div style="width:40px;height:40px;border-radius:50%;background:#006A4E;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;margin-bottom:16px">২</div>
              <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">৪টি স্লাইডের ফ্রি প্রিভিউ দেখো</h3>
              <p style="font-size:15px;color:#4A5148;margin:0">আসল স্লাইড ডিজাইন দেখো। পছন্দ না হলে ৩ বার বিনামূল্যে নতুন ডিজাইন তৈরি করতে পারবে।</p>
            </div>

            <div class="how-step" style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:18px;padding:24px;box-shadow:0 4px 12px rgba(17,20,15,0.05)">
              <div style="width:40px;height:40px;border-radius:50%;background:#0B2B21;color:#7FE0BC;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;margin-bottom:16px">৩</div>
              <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">পেমেন্ট ও চ্যাটে এডিট</h3>
              <p style="font-size:15px;color:#4A5148;margin:0">Bangla QR (bKash/Nagad) দিয়ে সহজ পেমেন্ট, তারপর ফুল ডেক ডাউনলোড ও আনলিমিটেড চ্যাটে এডিট।</p>
            </div>
          </div>
        </section>

        <!-- CONTROL REASSURANCE CARD -->
        <section style="background:#0B2B21;color:#F6F4EE;border-radius:20px;padding:32px 28px;margin:50px 0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px">
          <div>
            <h3 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#FFFFFF">পেমেন্টের পরেও তোমার নিয়ন্ত্রণে</h3>
            <p style="font-size:16px;color:#B8C4BC;margin:0;max-width:580px">চ্যাটে বললেই লেখা ও তথ্য বদলাবে। যতবার খুশি PPTX ও PDF ডাউনলোড করতে পারবে।</p>
          </div>
          <button type="button" id="btn-control-start" class="primary" style="background:#006A4E;font-size:16px;padding:12px 28px">শুরু করো →</button>
        </section>

        <!-- PAYMENT METHODS STRIP -->
        <div style="border-top:1px solid #DAD6C9;border-bottom:1px solid #DAD6C9;padding:18px 0;margin:40px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:14.5px;color:#4A5148">
          <span style="font-weight:700;color:#11140F">পেমেন্ট মাধ্যম:</span>
          <span>bKash · Nagad · Rocket · Upay · যেকোনো ব্যাংক অ্যাপ (Bangla QR)</span>
        </div>

        <!-- 5 NEW FAQS -->
        <section style="margin:50px 0">
          <h2 style="font-size:28px;font-weight:700;margin-bottom:24px">সাধারণ জিজ্ঞাসা (FAQ)</h2>
          <div style="display:flex;flex-direction:column;gap:14px">
            <details class="faq-item" style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:14px;padding:16px 20px">
              <summary style="font-weight:700;font-size:17px;cursor:pointer">প্রিভিউ পছন্দ না হলে?</summary>
              <p style="margin:12px 0 0;color:#4A5148;font-size:15px">"নতুন ডিজাইন" চাপো, ৩ বার বিনামূল্যে নতুন ডিজাইন ও কালার প্যালেট তৈরি করে দেখতে পারবে।</p>
            </details>
            <details class="faq-item" style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:14px;padding:16px 20px">
              <summary style="font-weight:700;font-size:17px;cursor:pointer">পেমেন্টের পর কতক্ষণে পাব?</summary>
              <p style="margin:12px 0 0;color:#4A5148;font-size:15px">সাধারণত ১০–৩০ মিনিটে TrxID যাচাই সম্পন্ন হয়, তারপর কয়েক মিনিটের মধ্যে পুরো ডেক তৈরি হয়ে ডাউনলোড অপশন ও এডিট চ্যাট খুলে যায়।</p>
            </details>
            <details class="faq-item" style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:14px;padding:16px 20px">
              <summary style="font-weight:700;font-size:17px;cursor:pointer">পরে এডিট করা যাবে?</summary>
              <p style="margin:12px 0 0;color:#4A5148;font-size:15px">হ্যাঁ, চ্যাটে যতবার খুশি যেকোনো স্লাইডের লেখা, পয়েন্ট ও তথ্য বদলাতে পারবে। স্লাইডের ডিজাইন থিম ও ফন্ট একই থাকবে।</p>
            </details>
            <details class="faq-item" style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:14px;padding:16px 20px">
              <summary style="font-weight:700;font-size:17px;cursor:pointer">ফাইল কোথায় পাব?</summary>
              <p style="margin:12px 0 0;color:#4A5148;font-size:15px">"আমার প্রেজেন্টেশন" সেকশনে তোমার প্রতিটি ডেক সংরক্ষিত থাকবে। সেখান থেকে যতবার খুশি PPTX ও PDF ফাইল ডাউনলোড করতে পারবে।</p>
            </details>
            <details class="faq-item" style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:14px;padding:16px 20px">
              <summary style="font-weight:700;font-size:17px;cursor:pointer">বাংলা ফন্ট ভাঙলে কী করব?</summary>
              <p style="margin:12px 0 0;color:#4A5148;font-size:15px">PDF ভার্সন ব্যবহার করতে পারো; আর Windows PowerPoint-এ Nirmala UI ফন্টে বাংলা লেখা সম্পূর্ণ নির্ভুলভাবে দেখা যাবে।</p>
            </details>
          </div>
        </section>
      </main>
    `;
  }

  // SCREEN 2: TOPIC + DESCRIPTION (STEP 1 / 2)
  function renderScreen2(): string {
    const words = getWordCount(state.description);
    state.wordCount = words;
    const isValid = state.topic.trim().length >= 3 && words >= 30 && words <= 1500;

    return `
      <main style="padding:20px 16px 80px">
        <div class="screen-card">
          <div class="screen-header-bar">
            <button type="button" class="screen-back-btn" id="btn-back-to-landing" aria-label="পিছনে">←</button>
            <h2 class="screen-title-text">নতুন প্রেজেন্টেশন</h2>
            <span class="screen-step-pill">ধাপ ১ / ২</span>
          </div>

          <!-- TOPIC FIELD -->
          <div style="margin-bottom:22px">
            <label for="input-topic" style="display:block;font-size:15px;font-weight:700;margin-bottom:8px;color:#11140F">
              প্রেজেন্টেশনের টপিক *
            </label>
            <input id="input-topic" type="text" value="${state.topic}" placeholder="যেমন: Climate Change and Bangladesh" style="width:100%;height:48px;padding:0 16px;border:1.5px solid #DAD6C9;border-radius:12px;font-size:16px;font-family:inherit;background:#FAF8F4;color:#11140F" required>
          </div>

          <!-- DESCRIPTION FIELD -->
          <div style="margin-bottom:20px">
            <label for="input-description" style="display:block;font-size:15px;font-weight:700;margin-bottom:4px;color:#11140F">
              ডেসক্রিপশন *
            </label>
            <p style="font-size:13.5px;color:#4A5148;margin:0 0 10px;line-height:1.5">
              কী কী থাকবে, মূল পয়েন্ট বা তথ্য লেখো। Heading দিলে সেটা স্লাইডের টাইটেল হিসেবে ধরা হবে। ছবি টুলবার থেকে যেখানে চাও সেখানে বসাও, AI ঐ অংশের স্লাইডেই রাখবে।
            </p>

            <!-- TIPTAP RICH TOOLBAR -->
            <div class="tiptap-wrap">
              <div class="tiptap-toolbar">
                <button type="button" class="tiptap-btn" data-action="undo" title="পূর্বাবস্থায় ফেরত">↶</button>
                <button type="button" class="tiptap-btn" data-action="redo" title="পুনরায়">↷</button>
                <button type="button" class="tiptap-btn" data-action="h1" title="Heading 1">H1</button>
                <button type="button" class="tiptap-btn" data-action="h2" title="Heading 2">H2</button>
                <button type="button" class="tiptap-btn" data-action="bold" title="Bold"><strong>B</strong></button>
                <button type="button" class="tiptap-btn" data-action="italic" title="Italic"><em>I</em></button>
                <button type="button" class="tiptap-btn" data-action="bullet" title="Bullet List">• ≡</button>
                <button type="button" class="tiptap-btn" data-action="number" title="Numbered List">1.</button>
                <button type="button" class="tiptap-btn" data-action="quote" title="Quote">“</button>
                <button type="button" class="tiptap-btn" data-action="divider" title="নতুন স্লাইড বিভাজক" style="font-size:11px;background:#F1EFEA">নতুন স্লাইড</button>
                <button type="button" class="tiptap-btn" data-action="code" title="Code">{ }</button>
                <button type="button" class="tiptap-btn" data-action="math" title="KaTeX Math">Σ</button>
                <button type="button" class="tiptap-btn" data-action="table" title="Table">⊞</button>
                <button type="button" class="tiptap-btn" data-action="image" title="ছবি আপলোড">🖼</button>
              </div>

              <textarea id="input-description" class="tiptap-editor-body" placeholder="লিখতে থাকো…">${state.description}</textarea>

              <div class="tiptap-footer ${words < 30 || words > 1500 ? 'word-error' : ''}">
                <span>কমপক্ষে ৩০ শব্দ · ছবি সর্বোচ্চ ৫টি</span>
                <strong id="word-count-badge">${words} / ১৫০০ শব্দ</strong>
              </div>
            </div>
          </div>

          <!-- OR DIVIDER -->
          <div style="text-align:center;margin:18px 0;position:relative">
            <span style="background:#FFFFFF;padding:0 12px;font-size:13.5px;color:#7A8278;position:relative;z-index:2">অথবা</span>
            <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:#DAD6C9"></div>
          </div>

          <!-- DOCX UPLOAD CARD -->
          <div id="docx-drop-zone" style="border:2px dashed #006A4E;border-radius:16px;padding:22px;text-align:center;background:#F4F8F6;cursor:pointer;margin-bottom:24px;transition:all 0.2s">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#006A4E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 8px">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <div style="font-weight:700;font-size:15px;color:#0B2B21">Word ফাইল (.docx) আপলোড করো</div>
            <div style="font-size:13px;color:#4A5148;margin-top:4px">সর্বোচ্চ ১৫০০ শব্দ · Bijoy বাংলা অটো-কনভার্ট হবে</div>
            <input type="file" id="docx-file-input" accept=".docx" style="display:none">
          </div>

          <!-- NEXT STEP BUTTON -->
          <button type="button" id="btn-to-step2" class="primary" style="width:100%;font-size:17px;font-weight:700;padding:14px;border-radius:999px" ${!isValid ? 'disabled' : ''}>
            পরের ধাপ →
          </button>
        </div>
      </main>
    `;
  }

  // SCREEN 3: SLIDE COUNT (STEP 2 / 2)
  function renderScreen3(): string {
    const price = state.slideCount * 32;

    return `
      <main style="padding:20px 16px 80px">
        <div class="screen-card">
          <div class="screen-header-bar">
            <button type="button" class="screen-back-btn" id="btn-back-to-step1" aria-label="পিছনে">←</button>
            <h2 class="screen-title-text">স্লাইড সংখ্যা</h2>
            <span class="screen-step-pill">ধাপ ২ / ২</span>
          </div>

          <div style="text-align:center;margin-top:10px">
            <h3 style="font-size:22px;font-weight:700;margin:0 0 6px;color:#11140F">কয়টি স্লাইড?</h3>
            <p style="font-size:14px;color:#4A5148;margin:0">টাইটেল স্লাইড ও ধন্যবাদ স্লাইড সহ (সর্বনিম্ন ৫, সর্বোচ্চ ৩০)</p>

            <!-- STEPPER -->
            <div class="stepper-container">
              <button type="button" class="stepper-control-btn" id="btn-stepper-minus" ${state.slideCount <= 5 ? 'disabled' : ''}>−</button>
              <span class="stepper-number-display" id="stepper-display">${state.slideCount}</span>
              <button type="button" class="stepper-control-btn" id="btn-stepper-plus" ${state.slideCount >= 30 ? 'disabled' : ''}>+</button>
            </div>

            <!-- SKIP BUTTON -->
            <button type="button" id="btn-skip-count" style="width:100%;border:1.5px dashed #006A4E;background:#F4F8F6;color:#006A4E;padding:12px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:8px">
              ▷ Skip — ডেসক্রিপশন দেখে AI নিজে ঠিক করুক
            </button>
            <p style="font-size:13px;color:#7A8278;margin:0 0 28px">Skip করলে সর্বোচ্চ ১৫টি স্লাইড। প্রিভিউর পর দাম দেখে সংখ্যা বদলাতে পারবে।</p>
          </div>

          <!-- LIVE ESTIMATED PRICE BOX -->
          <div style="background:#0B2B21;color:#F6F4EE;border-radius:16px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div>
              <span style="font-size:13.5px;color:#B8C4BC;display:block">আনুমানিক দাম</span>
              <span style="font-size:15px;font-weight:600" id="price-calc-formula">${state.slideCount} স্লাইড × ৳৩২</span>
            </div>
            <strong style="font-size:32px;font-weight:800;font-family:'Bricolage Grotesque',sans-serif;color:#7FE0BC" id="price-calc-total">৳${price}</strong>
          </div>

          <!-- PRIMARY ACTION -->
          <button type="button" id="btn-generate-preview" class="primary" style="width:100%;font-size:17px;font-weight:700;padding:14px;border-radius:999px">
            ফ্রি প্রিভিউ তৈরি করো
          </button>
          <p style="font-size:13px;color:#7A8278;text-align:center;margin:12px 0 0">
            Google দিয়ে লগইন লাগবে · এখন কোনো পেমেন্ট নেই
          </p>
        </div>
      </main>
    `;
  }

  // SCREEN 4: YOUR PREVIEW (4 / 12 SLIDES)
  function renderScreen4(): string {
    const price = state.slideCount * 32;
    const currentSlide = state.slides[0] || { title: state.topic, subtitle: 'AN OVERVIEW' };

    return `
      <main style="padding:20px 16px 80px">
        <div class="screen-card" style="max-width:680px">
          <div class="screen-header-bar">
            <button type="button" class="screen-back-btn" id="btn-back-to-count" aria-label="পিছনে">←</button>
            <h2 class="screen-title-text">তোমার প্রিভিউ</h2>
            <span class="screen-step-pill">৪ / ${state.slideCount} স্লাইড</span>
          </div>

          <!-- WATERMARKED PREVIEW CANVAS -->
          <div class="slide-watermark-card" id="preview-slide-canvas">
            <div class="slide-watermark-overlay">PowerPointBD PREVIEW</div>
            
            <div style="background:#006A4E;height:5px;width:100%"></div>
            <div style="padding:24px;flex:1;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg, #FAF8F4 0%, #FFFFFF 100%)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#006A4E;text-transform:uppercase">AN OVERVIEW</span>
                <span style="font-size:11px;font-weight:600;color:#7A8278">Calibri / Nirmala UI</span>
              </div>

              <div style="margin:20px 0">
                <h3 style="font-size:24px;font-weight:800;color:#0B2B21;margin:0 0 8px;line-height:1.2" id="preview-title-render">${currentSlide.title}</h3>
                <p style="font-size:14.5px;color:#4A5148;margin:0">[Presenter names &amp; overview]</p>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #DAD6C9;padding-top:10px;font-size:12px;color:#7A8278">
                <span>PowerPointBD AI Studio</span>
                <span>Slide 1 of ${state.slideCount}</span>
              </div>
            </div>
          </div>

          <!-- THUMBNAIL SELECTOR STRIP -->
          <div class="slide-tab-strip">
            <button type="button" class="slide-tab-item active" data-slide="1">
              <span style="font-weight:700;color:#006A4E">১</span>
              <span style="font-size:10px;color:#7A8278">Title</span>
            </button>
            <button type="button" class="slide-tab-item" data-slide="2">
              <span style="font-weight:700;color:#006A4E">২</span>
              <span style="font-size:10px;color:#7A8278">Points</span>
            </button>
            <button type="button" class="slide-tab-item" data-slide="3">
              <span style="font-weight:700;color:#006A4E">৩</span>
              <span style="font-size:10px;color:#7A8278">Timeline</span>
            </button>
            <button type="button" class="slide-tab-item" data-slide="4">
              <span style="font-weight:700;color:#006A4E">৪</span>
              <span style="font-size:10px;color:#7A8278">Chart</span>
            </button>
          </div>
          <p style="font-size:13px;color:#7A8278;margin:0 0 16px;text-align:center">
            ট্যাপ করে বড় করে দেখো · প্রিভিউ শুধু ছবি, ডাউনলোড পেমেন্টের পর
          </p>

          <!-- AI SPECIFICATION CARD -->
          <div class="ai-spec-card">
            <div class="ai-spec-title">AI যা ঠিক করেছে</div>
            <p class="ai-spec-body">
              কালার: সমুদ্র নীল + উষ্ণ কমলা (জলবায়ু ও পরিবেশের থিম) · ফন্ট: Calibri / Nirmala UI · ${state.slideCount} স্লাইড: টাইটেল, ${state.slideCount - 3}টি ইনফোগ্রাফিক, রেফারেন্স, ধন্যবাদ
            </p>
          </div>

          <!-- REGENERATE BUTTON WITH COUNTER -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin:16px 0 24px">
            <button type="button" id="btn-regenerate-design" style="padding:10px 20px;border-radius:999px;border:1.5px solid #11140F;background:#FFFFFF;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px" ${state.regeneratesUsed >= 3 ? 'disabled' : ''}>
              <span>↻ নতুন ডিজাইন</span>
            </button>
            <span style="font-size:13.5px;color:#7A8278;font-weight:600">
              ${Math.max(0, 3 - state.regeneratesUsed)}টি বাকি
            </span>
          </div>

          <!-- PRICE & UNLOCK BAR -->
          <div style="background:#0B2B21;color:#F6F4EE;border-radius:18px;padding:20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <span style="font-size:16px;font-weight:600">${state.slideCount} স্লাইড × ৳৩২</span>
            <strong style="font-size:32px;font-weight:800;font-family:'Bricolage Grotesque',sans-serif;color:#7FE0BC">৳${price}</strong>
          </div>

          <button type="button" id="btn-unlock-deck" class="primary" style="width:100%;font-size:17px;font-weight:700;padding:15px;border-radius:999px">
            ডিজাইন পছন্দ — পুরো ডেক আনলক করো
          </button>
          <p style="font-size:13px;color:#7A8278;text-align:center;margin:10px 0 0">
            পেমেন্টের পর সব স্লাইড + আনলিমিটেড এডিট চ্যাট
          </p>
        </div>
      </main>
    `;
  }

  // SCREEN 5: PAYMENT (BANGLA QR + TRXID)
  function renderScreen5(): string {
    const price = state.slideCount * 32;

    return `
      <main style="padding:20px 16px 80px">
        <div class="screen-card">
          <div class="screen-header-bar">
            <button type="button" class="screen-back-btn" id="btn-back-to-preview" aria-label="পিছনে">←</button>
            <h2 class="screen-title-text">পেমেন্ট</h2>
          </div>

          <div style="margin-bottom:20px">
            <div style="font-size:15px;color:#4A5148">${state.topic} · ${state.slideCount} স্লাইড</div>
            <strong style="font-size:38px;font-weight:800;color:#0B2B21;font-family:'Bricolage Grotesque',sans-serif">৳${price}</strong>
          </div>

          <!-- BANGLA QR IMAGE CARD -->
          <div style="background:#FFFFFF;border:1.5px solid #DAD6C9;border-radius:18px;padding:24px;text-align:center;margin-bottom:24px;box-shadow:0 8px 24px -12px rgba(17,20,15,0.08)">
            <div style="max-width:240px;margin:0 auto 16px;aspect-ratio:1;border:2px dashed #006A4E;border-radius:14px;display:flex;align-items:center;justify-content:center;background:#FAF8F4">
              <div style="text-align:center;padding:16px">
                <div style="font-weight:800;color:#006A4E;font-size:18px;margin-bottom:4px">Bangla QR</div>
                <div style="font-size:12px;color:#4A5148">Merchant Scan &amp; Pay</div>
                <div style="font-family:monospace;font-size:13px;font-weight:700;color:#C8102E;margin-top:8px">01800000000</div>
              </div>
            </div>

            <p style="font-size:14px;color:#4A5148;margin:0 0 16px">
              bKash · Nagad · Rocket · Upay · যেকোনো ব্যাংক অ্যাপ দিয়ে স্ক্যান করো
            </p>

            <button type="button" id="btn-save-qr" class="secondary" style="font-size:14px;padding:9px 20px;border-radius:999px">
              QR ছবি সেভ করো
            </button>
          </div>

          <!-- TRXID INPUT -->
          <div style="margin-bottom:24px">
            <label for="input-trxid" style="display:block;font-size:15px;font-weight:700;margin-bottom:6px;color:#11140F">
              Transaction ID (TrxID)
            </label>
            <input id="input-trxid" type="text" value="${state.trxId}" placeholder="যেমন: 9K7X2ABCD1" style="width:100%;height:48px;padding:0 16px;border:1.5px solid #DAD6C9;border-radius:12px;font-size:16px;font-family:monospace;background:#FAF8F4" required>
            <span style="font-size:13px;color:#7A8278;display:block;margin-top:4px">পেমেন্টের SMS-এ TrxID পাবে</span>
          </div>

          <!-- SUBMIT BUTTON -->
          <button type="button" id="btn-submit-payment" class="primary" style="width:100%;font-size:17px;font-weight:700;padding:14px;border-radius:999px">
            পেমেন্ট সাবমিট করো
          </button>

          <!-- VERIFICATION NOTICE -->
          <div style="background:#FAF8F4;border:1px solid #DAD6C9;border-radius:14px;padding:16px;margin-top:20px;display:flex;gap:12px">
            <span style="font-size:20px">⏱</span>
            <div style="font-size:13.5px;color:#4A5148;line-height:1.5">
              <strong style="color:#0B2B21;display:block;margin-bottom:2px">সাবমিটের পর: যাচাই চলছে</strong>
              সাধারণত ১০–৩০ মিনিট। যাচাই হলেই পুরো ডেক তৈরি শুরু হবে আর SMS/ইমেইলে জানানো হবে।
            </div>
          </div>
        </div>
      </main>
    `;
  }

  // SCREEN 6: FULL DECK + EDIT CHAT
  function renderScreen6(): string {
    return `
      <main style="padding:20px 16px 80px">
        <div class="screen-card" style="max-width:720px">
          <div class="screen-header-bar">
            <button type="button" class="screen-back-btn" id="btn-back-to-home" aria-label="পিছনে">←</button>
            <div>
              <h2 class="screen-title-text">${state.topic}</h2>
              <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#006A4E;background:#E3EEE8;padding:3px 10px;border-radius:999px;margin-top:4px">
                <span style="width:7px;height:7px;border-radius:50%;background:#006A4E"></span>
                পেমেন্ট যাচাই হয়েছে · ${state.slideCount} স্লাইড
              </span>
            </div>
          </div>

          <!-- ALL 12 SLIDES THUMBNAIL GRID -->
          <div class="deck-grid-container" id="deck-thumbnails-grid">
            ${Array.from({ length: state.slideCount }, (_, i) => `
              <div class="deck-slide-card" data-slide-index="${i + 1}" title="Slide ${i + 1}">
                <span class="badge-num">${i + 1}</span>
                <span class="card-title">${state.slides[i]?.title || `স্লাইড ${i + 1}`}</span>
              </div>
            `).join('')}
          </div>

          <!-- DOWNLOAD BUTTONS -->
          <div style="display:flex;gap:12px;margin:20px 0 28px;flex-wrap:wrap">
            <button type="button" id="btn-download-pptx" class="primary" style="flex:1 1 180px;font-size:16px;font-weight:700;padding:12px 20px;display:inline-flex;align-items:center;justify-content:center;gap:8px">
              <span>PPTX ডাউনলোড</span>
            </button>
            <button type="button" id="btn-download-pdf" class="secondary" style="flex:1 1 180px;font-size:16px;font-weight:700;padding:12px 20px;border-color:#11140F;display:inline-flex;align-items:center;justify-content:center;gap:8px">
              <span>PDF ডাউনলোড</span>
            </button>
          </div>

          <!-- AI EDIT CHAT SHELL -->
          <div class="chat-shell">
            <div class="chat-stream" id="chat-messages-box">
              ${state.chatHistory.map(msg => `
                <div class="chat-bubble ${msg.role}">
                  ${msg.text}
                  ${msg.version ? `<div class="slide-update-tag">✓ ${msg.version}</div>` : ''}
                </div>
              `).join('')}
            </div>

            <div style="border-top:1px solid #DAD6C9;padding-top:12px;margin-top:12px">
              <div style="font-size:12px;color:#7A8278;margin-bottom:8px;display:flex;align-items:center;gap:6px">
                <span>🔒</span>
                <span>ডিজাইন লক করা · শুধু লেখা, তথ্য ও ছবি এডিট হবে</span>
              </div>

              <form id="chat-form" style="display:flex;gap:8px">
                <input id="chat-input" type="text" placeholder="কী বদলাতে চাও?" style="flex:1;height:44px;padding:0 16px;border:1.5px solid #DAD6C9;border-radius:999px;font-size:14.5px;background:#FAF8F4" required>
                <button type="submit" class="primary" style="width:44px;height:44px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">
                  →
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  // SCREEN 7: MY PRESENTATIONS (PROFILE / ORDERS)
  function renderScreen7(): string {
    return `
      <main style="padding:20px 16px 80px">
        <div class="screen-card" style="max-width:680px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
            <h2 style="font-size:24px;font-weight:800;color:#11140F;margin:0">আমার প্রেজেন্টেশন</h2>
            <div style="width:40px;height:40px;border-radius:50%;background:#006A4E;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:700">R</div>
          </div>

          <button type="button" id="btn-profile-new-deck" class="primary" style="width:100%;font-size:16px;font-weight:700;padding:13px;border-radius:14px;margin-bottom:24px">
            + নতুন প্রেজেন্টেশন
          </button>

          <!-- ORDER CARDS LIST (WITH REAL REALISTIC TITLES AND FORMATTED DATES) -->
          <div style="display:flex;flex-direction:column;gap:16px">
            <!-- Order 1: Ready -->
            <div style="background:#FFFFFF;border:1.5px solid #DAD6C9;border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 12px rgba(17,20,15,0.05)">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                <div style="width:48px;height:36px;border-radius:6px;background:#0B2B21;flex:none"></div>
                <div style="flex:1">
                  <h3 style="font-size:17px;font-weight:700;margin:0 0 4px;color:#11140F">Climate Change and Bangladesh</h3>
                  <span style="font-size:13px;color:#7A8278">১২ স্লাইড · ০৫ নভেম্বর ২০২৬</span>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #F1EFEA;padding-top:12px">
                <span style="background:#E3EEE8;color:#006A4E;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px">রেডি</span>
                <div style="display:flex;gap:8px">
                  <button type="button" class="btn-order-chat secondary" data-order="order_1" style="padding:6px 14px;font-size:13px">চ্যাট</button>
                  <button type="button" class="btn-order-download primary" data-order="order_1" style="padding:6px 14px;font-size:13px">ডাউনলোড</button>
                </div>
              </div>
            </div>

            <!-- Order 2: Pending Verification -->
            <div style="background:#FFFFFF;border:1.5px solid #DAD6C9;border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 12px rgba(17,20,15,0.05)">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                <div style="width:48px;height:36px;border-radius:6px;background:#4338CA;flex:none"></div>
                <div style="flex:1">
                  <h3 style="font-size:17px;font-weight:700;margin:0 0 4px;color:#11140F">বাংলাদেশে নবায়নযোগ্য জ্বালানি ও টেকসই রূপান্তর</h3>
                  <span style="font-size:13px;color:#7A8278">১০ স্লাইড · ০৪ নভেম্বর ২০২৬</span>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #F1EFEA;padding-top:12px">
                <span style="background:#FEF3C7;color:#B45309;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px">যাচাই চলছে</span>
                <span style="font-size:12.5px;color:#7A8278">১০-৩০ মিনিট অপেক্ষা করুন</span>
              </div>
            </div>

            <!-- Order 3: Preview Pending Payment -->
            <div style="background:#FFFFFF;border:1.5px solid #DAD6C9;border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 12px rgba(17,20,15,0.05)">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                <div style="width:48px;height:36px;border-radius:6px;background:#0369A1;flex:none"></div>
                <div style="flex:1">
                  <h3 style="font-size:17px;font-weight:700;margin:0 0 4px;color:#11140F">ডেল্টা প্ল্যান ২১০০: আধুনিক নদী শাসন ও কৃষি ব্যবস্থাপনা</h3>
                  <span style="font-size:13px;color:#7A8278">১৫ স্লাইড · ০২ নভেম্বর ২০২৬</span>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #F1EFEA;padding-top:12px">
                <span style="background:#E0F2FE;color:#0369A1;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px">প্রিভিউ · পেমেন্ট বাকি</span>
                <button type="button" class="btn-order-resume primary" data-order="order_3" style="padding:6px 14px;font-size:13px">প্রিভিউ দেখো ও পেমেন্ট</button>
              </div>
            </div>
          </div>

          <p style="font-size:13px;color:#7A8278;text-align:center;margin:28px 0 0">
            পেমেন্ট করা প্রতিটি প্রেজেন্টেশন যতবার খুশি ডাউনলোড করতে পারবে
          </p>
        </div>
      </main>
    `;
  }

  // SCREEN 8: ADMIN PANEL (/admin)
  function renderScreen8(): string {
    return `
      <main class="admin-shell">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:12px">
            <button type="button" class="screen-back-btn" id="btn-admin-exit">←</button>
            <h1 style="font-size:26px;font-weight:800;color:#11140F;margin:0">PowerPointBD Admin Panel</h1>
          </div>
          <span style="font-size:13px;color:#7A8278;font-weight:600">Today · ০৬ নভেম্বর ২০২৬</span>
        </div>

        <!-- ADMIN TABS -->
        <div class="admin-tab-nav">
          <button type="button" class="admin-tab-btn ${state.adminTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
          <button type="button" class="admin-tab-btn ${state.adminTab === 'payments' ? 'active' : ''}" data-tab="payments">Payments <span style="background:#C8102E;color:#FFFFFF;border-radius:999px;padding:1px 6px;font-size:11px">3</span></button>
          <button type="button" class="admin-tab-btn ${state.adminTab === 'usage' ? 'active' : ''}" data-tab="usage">Users &amp; Usage</button>
          <button type="button" class="admin-tab-btn ${state.adminTab === 'instructions' ? 'active' : ''}" data-tab="instructions">Design Instructions</button>
          <button type="button" class="admin-tab-btn ${state.adminTab === 'ai' ? 'active' : ''}" data-tab="ai">Admin AI</button>
          <button type="button" class="admin-tab-btn ${state.adminTab === 'pricing' ? 'active' : ''}" data-tab="pricing">Pricing &amp; Limits</button>
        </div>

        <!-- TAB CONTENT -->
        ${renderAdminTabContent()}
      </main>
    `;
  }

  function renderAdminTabContent(): string {
    if (state.adminTab === 'overview') {
      return `
        <div>
          <div class="admin-stat-grid">
            <div class="admin-stat-card">
              <div class="label">Paid orders</div>
              <div class="val">৪২</div>
            </div>
            <div class="admin-stat-card">
              <div class="label">Revenue</div>
              <div class="val" style="color:#006A4E">৳১৬,১২৮</div>
            </div>
            <div class="admin-stat-card">
              <div class="label">AI cost (Sonnet 5.5)</div>
              <div class="val" style="color:#C8102E">৳১,৫৪০</div>
            </div>
            <div class="admin-stat-card">
              <div class="label">Gross margin</div>
              <div class="val" style="color:#0B2B21">৯০.৫%</div>
            </div>
          </div>

          <h3 style="font-size:18px;font-weight:700;margin:28px 0 14px">Pending payments — verify TrxID against bank/MFS statement</h3>
          <div style="overflow-x:auto">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Deck</th>
                  <th>Amount</th>
                  <th>TrxID</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>student@gmail.com</td>
                  <td>Climate Change and Bangladesh</td>
                  <td><strong>৳৩৮৪</strong></td>
                  <td><code style="background:#F1EFEA;padding:2px 6px;border-radius:4px">9K7X2ABCD1</code></td>
                  <td>12m ago</td>
                  <td>
                    <button type="button" class="btn-approve-trx primary" data-id="pay_1" style="padding:5px 12px;font-size:12px">Approve</button>
                    <button type="button" class="btn-reject-trx secondary" data-id="pay_1" style="padding:5px 12px;font-size:12px;color:#C8102E">Reject</button>
                  </td>
                </tr>
                <tr>
                  <td>sazzad.cuet@gmail.com</td>
                  <td>Renewable Energy in South Asia</td>
                  <td><strong>৳৩২০</strong></td>
                  <td><code style="background:#F1EFEA;padding:2px 6px;border-radius:4px">8M2N5XYZ89</code></td>
                  <td>24m ago</td>
                  <td>
                    <button type="button" class="btn-approve-trx primary" data-id="pay_2" style="padding:5px 12px;font-size:12px">Approve</button>
                    <button type="button" class="btn-reject-trx secondary" data-id="pay_2" style="padding:5px 12px;font-size:12px;color:#C8102E">Reject</button>
                  </td>
                </tr>
                <tr>
                  <td>tanvir.du@gmail.com</td>
                  <td>AI in Healthcare Diagnosis</td>
                  <td><strong>৳৪৮০</strong></td>
                  <td><code style="background:#F1EFEA;padding:2px 6px;border-radius:4px">7P4Q1WERT2</code></td>
                  <td>45m ago</td>
                  <td>
                    <button type="button" class="btn-approve-trx primary" data-id="pay_3" style="padding:5px 12px;font-size:12px">Approve</button>
                    <button type="button" class="btn-reject-trx secondary" data-id="pay_3" style="padding:5px 12px;font-size:12px;color:#C8102E">Reject</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (state.adminTab === 'payments') {
      return `
        <div>
          <h3 style="font-size:20px;font-weight:700;margin-bottom:16px">Pending Payment Verification</h3>
          <p style="font-size:14px;color:#4A5148;margin-bottom:20px">TrxID, amount ও সময় bKash/ব্যাংক merchant স্টেটমেন্টের সাথে মিলিয়ে Approve করুন।</p>
          <div style="overflow-x:auto">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Deck</th>
                  <th>Amount</th>
                  <th>TrxID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>student@gmail.com</td>
                  <td>Climate Change and Bangladesh (12 slides)</td>
                  <td><strong>৳৩৮৪</strong></td>
                  <td><code style="background:#F1EFEA;padding:4px 8px;border-radius:4px;font-size:14px">9K7X2ABCD1</code></td>
                  <td>
                    <button type="button" class="btn-approve-trx primary" data-id="pay_1" style="padding:6px 14px;font-size:13px">Approve</button>
                    <button type="button" class="btn-reject-trx secondary" data-id="pay_1" style="padding:6px 14px;font-size:13px;color:#C8102E">Reject</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (state.adminTab === 'usage') {
      return `
        <div>
          <h3 style="font-size:20px;font-weight:700;margin-bottom:16px">Chat usage &amp; abuse flags per order</h3>
          <div style="overflow-x:auto">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Order</th>
                  <th>Messages</th>
                  <th>Tokens In/Out</th>
                  <th>Chat Cost</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>student@gmail.com</td>
                  <td>৳৩৮৪</td>
                  <td>3</td>
                  <td>12.4k / 1.8k</td>
                  <td>৳৮.২০</td>
                  <td><span class="flag-pill ok">OK</span></td>
                </tr>
                <tr>
                  <td>sazzad.cuet@gmail.com</td>
                  <td>৳৩২০</td>
                  <td>14</td>
                  <td>58.2k / 8.6k</td>
                  <td>৳৩৭.৫০</td>
                  <td><span class="flag-pill warn">Soft-cap crossed</span></td>
                </tr>
                <tr>
                  <td>tanvir.du@gmail.com</td>
                  <td>৳৪৮০</td>
                  <td>6</td>
                  <td>28.1k / 4.1k</td>
                  <td>৳১৯.১০</td>
                  <td><span class="flag-pill drift">Topic drift</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (state.adminTab === 'instructions') {
      return `
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 style="font-size:20px;font-weight:700;margin:0">System Design Instructions</h3>
            <span style="background:#E3EEE8;color:#006A4E;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px">Live: v3</span>
          </div>

          <div style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:16px;padding:20px;margin-bottom:20px">
            <label style="display:block;font-size:14px;font-weight:700;margin-bottom:8px">Draft v4 — system instructions for every new deck (admins only)</label>
            <textarea id="admin-instruction-body" style="width:100%;height:140px;border:1.5px solid #DAD6C9;border-radius:10px;padding:12px;font-family:monospace;font-size:13.5px;background:#FAF8F4">Infographic-first. Max 6 points per slide. Fonts: Calibri (English), Nirmala UI (Bangla). Title slide + Thank you slide always included. H1/H2 in the description = slide title hint; divider = slide break; table = chart or table slide.</textarea>

            <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
              <button type="button" id="btn-test-sample" class="secondary" style="font-size:14px">Test on sample brief</button>
              <button type="button" id="btn-publish-draft" class="primary" style="font-size:14px">Publish v4</button>
              <button type="button" id="btn-rollback" class="secondary" style="font-size:14px">Rollback to v2</button>
            </div>
            <p style="font-size:12px;color:#7A8278;margin:10px 0 0">
              Every deck stores the version it was made with. Old decks keep their version in chat edits.
            </p>
          </div>
        </div>
      `;
    } else if (state.adminTab === 'ai') {
      return `
        <div>
          <h3 style="font-size:20px;font-weight:700;margin-bottom:16px">Admin AI Assistant (Claude Sonnet 5.5)</h3>
          <div style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:16px;padding:20px;max-width:700px">
            <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
              <div class="chat-bubble user" style="align-self:flex-end">Pharmacy students' decks look too plain. What should change?</div>
              <div class="chat-bubble assistant" style="align-self:flex-start">Drafted a change for v4: use mechanism diagrams and process flows for drug-action topics. Test it on a sample brief before publishing.<br><span style="display:inline-block;margin-top:6px;font-size:11.5px;background:#E3EEE8;color:#006A4E;padding:2px 8px;border-radius:999px;font-weight:700">Draft only · needs your approval</span></div>
            </div>
            <form id="admin-ai-form" style="display:flex;gap:8px">
              <input type="text" id="admin-ai-input" placeholder="Discuss design, pricing, prompt tuning…" style="flex:1;height:42px;padding:0 14px;border:1.5px solid #DAD6C9;border-radius:999px;font-size:14px">
              <button type="submit" class="primary" style="padding:0 20px;font-size:14px">Send</button>
            </form>
          </div>
        </div>
      `;
    } else if (state.adminTab === 'pricing') {
      return `
        <div>
          <h3 style="font-size:20px;font-weight:700;margin-bottom:16px">Pricing &amp; Limits Management</h3>
          <div style="background:#FFFFFF;border:1px solid #DAD6C9;border-radius:16px;padding:24px;max-width:620px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
              <div>
                <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Price per slide (৳)</label>
                <input type="number" id="cfg-price" value="32" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #DAD6C9;border-radius:8px">
              </div>
              <div>
                <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Description word limit</label>
                <input type="number" id="cfg-words" value="1500" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #DAD6C9;border-radius:8px">
              </div>
              <div>
                <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Free regenerates</label>
                <input type="number" id="cfg-regen" value="3" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #DAD6C9;border-radius:8px">
              </div>
              <div>
                <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Chat soft-cap (% of order)</label>
                <input type="number" id="cfg-softcap" value="30" style="width:100%;height:40px;padding:0 12px;border:1.5px solid #DAD6C9;border-radius:8px">
              </div>
            </div>
            <button type="button" id="btn-save-pricing" class="primary" style="padding:10px 24px;font-size:14px">সেটিংস সংরক্ষণ করো</button>
          </div>
        </div>
      `;
    }
    return '';
  }

  // ATTACH DOM EVENTS
  function attachEvents() {
    // Navigation & header buttons
    document.getElementById('brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('landing');
    });

    document.getElementById('btn-my-presentations')?.addEventListener('click', () => {
      navigate('profile');
    });

    document.getElementById('btn-nav-admin')?.addEventListener('click', () => {
      navigate('admin');
    });

    document.getElementById('btn-hero-cta')?.addEventListener('click', (e) => {
      buttonRipple(e.currentTarget as HTMLElement, e as unknown as MouseEvent);
      navigate('topic');
    });

    document.getElementById('btn-control-start')?.addEventListener('click', () => {
      navigate('topic');
    });

    // Screen 2 events (Topic & Description)
    document.getElementById('btn-back-to-landing')?.addEventListener('click', () => {
      navigate('landing');
    });

    const topicInput = document.getElementById('input-topic') as HTMLInputElement | null;
    const descInput = document.getElementById('input-description') as HTMLTextAreaElement | null;
    const nextBtn = document.getElementById('btn-to-step2') as HTMLButtonElement | null;

    function validateStep1() {
      if (!topicInput || !descInput || !nextBtn) return;
      state.topic = topicInput.value;
      state.description = descInput.value;
      const words = getWordCount(state.description);
      state.wordCount = words;
      const countBadge = document.getElementById('word-count-badge');
      if (countBadge) countBadge.textContent = `${words} / ১৫০০ শব্দ`;
      nextBtn.disabled = !(state.topic.trim().length >= 3 && words >= 30 && words <= 1500);
    }

    topicInput?.addEventListener('input', validateStep1);
    descInput?.addEventListener('input', validateStep1);

    // TipTap toolbar actions
    document.querySelectorAll('.tiptap-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action;
        if (!descInput) return;
        const start = descInput.selectionStart;
        const end = descInput.selectionEnd;
        const selected = descInput.value.substring(start, end);

        let insert = '';
        if (action === 'h1') insert = `\n# ${selected || 'স্লাইড টাইটেল'}\n`;
        else if (action === 'h2') insert = `\n## ${selected || 'উপ-শিরোনাম'}\n`;
        else if (action === 'bold') insert = `**${selected || 'গুরুত্বপূর্ণ পয়েন্ট'}**`;
        else if (action === 'italic') insert = `*${selected || 'ইটালিক লেখা'}*`;
        else if (action === 'bullet') insert = `\n• ${selected || 'ইনফোগ্রাফিক পয়েন্ট'}\n`;
        else if (action === 'number') insert = `\n1. ${selected || 'প্রথম ধাপ'}\n`;
        else if (action === 'quote') insert = `\n> ${selected || 'উদ্ধৃতি বা মূল বক্তব্য'}\n`;
        else if (action === 'divider') insert = `\n---\n[নতুন স্লাইড]\n`;
        else if (action === 'code') insert = `\n\`\`\`\n${selected || '// কোড স্নsnippet'}\n\`\`\`\n`;
        else if (action === 'math') insert = ` $E = mc^2$ `;
        else if (action === 'table') insert = `\n| খাত | বর্তমান অবস্থা | লক্ষ্যমাত্রা |\n|---|---|---|\n| নবায়নযোগ্য | ১০% | ৪০% |\n`;
        else if (action === 'image') insert = `\n![স্লাইড ছবি](image_placement)\n`;

        descInput.setRangeText(insert, start, end, 'end');
        validateStep1();
      });
    });

    // .docx Upload with mammoth and Bijoy converter
    const dropZone = document.getElementById('docx-drop-zone');
    const fileInput = document.getElementById('docx-file-input') as HTMLInputElement | null;
    dropZone?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          let parsedText = result.value || '';

          // Auto-detect and convert Bijoy (SutonnyMJ) if detected
          if (isBijoy(parsedText)) {
            parsedText = convertBijoyToUnicode(parsedText);
          }

          if (descInput) {
            descInput.value = parsedText;
            validateStep1();
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        console.error('Failed to parse docx:', err);
        alert('Word (.docx) ফাইল পার্স করতে সমস্যা হয়েছে। অনুগ্রহ করে টেক্সট কপি করে পেস্ট করুন।');
      }
    });

    nextBtn?.addEventListener('click', (e) => {
      buttonRipple(e.currentTarget as HTMLElement, e as unknown as MouseEvent);
      navigate('count');
    });

    // Screen 3 events (Slide count)
    document.getElementById('btn-back-to-step1')?.addEventListener('click', () => {
      navigate('topic');
    });

    const minusBtn = document.getElementById('btn-stepper-minus') as HTMLButtonElement | null;
    const plusBtn = document.getElementById('btn-stepper-plus') as HTMLButtonElement | null;
    const displayNum = document.getElementById('stepper-display');
    const priceFormula = document.getElementById('price-calc-formula');
    const priceTotal = document.getElementById('price-calc-total');

    function updateStepper() {
      if (displayNum) displayNum.textContent = String(state.slideCount);
      if (minusBtn) minusBtn.disabled = state.slideCount <= 5;
      if (plusBtn) plusBtn.disabled = state.slideCount >= 30;
      if (priceFormula) priceFormula.textContent = `${state.slideCount} স্লাইড × ৳৩২`;
      if (priceTotal) {
        animateNumber(priceTotal, (state.slideCount - 1) * 32, state.slideCount * 32);
      }
    }

    minusBtn?.addEventListener('click', () => {
      if (state.slideCount > 5) {
        state.slideCount--;
        updateStepper();
      }
    });

    plusBtn?.addEventListener('click', () => {
      if (state.slideCount < 30) {
        state.slideCount++;
        updateStepper();
      }
    });

    document.getElementById('btn-skip-count')?.addEventListener('click', () => {
      state.slideCount = Math.min(15, Math.max(8, Math.round(state.wordCount / 40)));
      updateStepper();
    });

    document.getElementById('btn-generate-preview')?.addEventListener('click', async (e) => {
      buttonRipple(e.currentTarget as HTMLElement, e as unknown as MouseEvent);
      // Simulate backend preview generation
      navigate('preview');
    });

    // Screen 4 events (Preview)
    document.getElementById('btn-back-to-count')?.addEventListener('click', () => {
      navigate('count');
    });

    document.querySelectorAll('.slide-tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.slide-tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const num = Number((tab as HTMLElement).dataset.slide || 1);
        const titleRender = document.getElementById('preview-title-render');
        if (titleRender && state.slides[num - 1]) {
          titleRender.textContent = state.slides[num - 1].title;
        }
      });
    });

    document.getElementById('btn-regenerate-design')?.addEventListener('click', () => {
      if (state.regeneratesUsed < 3) {
        state.regeneratesUsed++;
        render();
      }
    });

    document.getElementById('btn-unlock-deck')?.addEventListener('click', (e) => {
      buttonRipple(e.currentTarget as HTMLElement, e as unknown as MouseEvent);
      navigate('payment');
    });

    // Screen 5 events (Payment)
    document.getElementById('btn-back-to-preview')?.addEventListener('click', () => {
      navigate('preview');
    });

    document.getElementById('btn-save-qr')?.addEventListener('click', () => {
      alert('Bangla QR কোড ডাউনলোড হয়েছে। যেকোনো MFS বা ব্যাংক অ্যাপ দিয়ে স্ক্যান করে পেমেন্ট সম্পন্ন করুন।');
    });

    const trxInput = document.getElementById('input-trxid') as HTMLInputElement | null;
    document.getElementById('btn-submit-payment')?.addEventListener('click', () => {
      const val = trxInput?.value.trim();
      if (!val) {
        if (trxInput) shakeElement(trxInput);
        alert('অনুগ্রহ করে SMS-এ প্রাপ্ত Transaction ID (TrxID) প্রদান করুন।');
        return;
      }
      state.trxId = val;
      state.paymentStatus = 'pending_verification';
      alert('TrxID সফলভাবে জমা হয়েছে। পেমেন্ট যাচাই চলছে (সাধারণত ১০-৩০ মিনিট)। অ্যাডমিন যাচাই শেষে ফুল ডেক ডাউনলোড উন্মুক্ত হবে।');
      navigate('profile');
    });

    // Screen 6 events (Deck + Chat)
    document.getElementById('btn-back-to-home')?.addEventListener('click', () => {
      navigate('landing');
    });

    document.getElementById('btn-download-pptx')?.addEventListener('click', async (e) => {
      buttonRipple(e.currentTarget as HTMLElement, e as unknown as MouseEvent);
      await exportToPptx({ title: state.topic, slides: state.slides });
    });

    document.getElementById('btn-download-pdf')?.addEventListener('click', (e) => {
      buttonRipple(e.currentTarget as HTMLElement, e as unknown as MouseEvent);
      exportToPdf({ title: state.topic, slides: state.slides });
    });

    // Slide preview in deck grid
    document.querySelectorAll('.deck-slide-card').forEach(card => {
      card.addEventListener('click', () => {
        const slideIdx = Number((card as HTMLElement).dataset.slideIndex || 1);
        alert(`স্লাইড ${slideIdx}: ${state.slides[slideIdx - 1]?.title || 'বিস্তারিত বিবরণী'}`);
      });
    });

    // Chat submit
    const chatForm = document.getElementById('chat-form') as HTMLFormElement | null;
    const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
    chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = chatInput?.value.trim();
      if (!msg) return;

      const lower = msg.toLowerCase();
      state.chatHistory.push({ role: 'user', text: msg });

      // Technical abuse guard checks (Section 8)
      if (lower.includes('color') || lower.includes('কালার') || lower.includes('font') || lower.includes('থিম')) {
        state.chatHistory.push({
          role: 'assistant',
          text: 'ডিজাইন থিম, কালার ও ফন্ট অপরিবর্তনীয় (লক করা আছে)। আপনি যেকোনো স্লাইডের লেখা, তথ্য, পয়েন্ট বা ছবি পরিবর্তন করতে পারেন।'
        });
      } else if (lower.includes('machine learning') || lower.includes('মেশিন লার্নিং') || lower.includes('নতুন প্রেজেন্টেশন')) {
        state.chatHistory.push({
          role: 'assistant',
          text: 'অনুরোধটি মূল বিষয়ের বাইরের একটি নতুন প্রেজেন্টেশন মনে হচ্ছে। দয়া করে নতুন প্রেজেন্টেশন অর্ডার করুন।'
        });
      } else {
        // Successful edit
        state.chatHistory.push({
          role: 'assistant',
          text: `করা হয়েছে। স্লাইড ৫-এ আপনার নির্দেশনা অনুযায়ী তথ্য হালনাগাদ করা হয়েছে, বাকি ডিজাইন অক্ষুণ্ন রয়েছে।`,
          version: 'স্লাইড ৫ আপডেট · v3'
        });
      }

      if (chatInput) chatInput.value = '';
      render();
    });

    // Screen 7 events (Profile)
    document.getElementById('btn-profile-new-deck')?.addEventListener('click', () => {
      navigate('topic');
    });

    document.querySelectorAll('.btn-order-chat').forEach(b => {
      b.addEventListener('click', () => navigate('deck'));
    });
    document.querySelectorAll('.btn-order-download').forEach(b => {
      b.addEventListener('click', () => navigate('deck'));
    });
    document.querySelectorAll('.btn-order-resume').forEach(b => {
      b.addEventListener('click', () => navigate('preview'));
    });

    // Screen 8 events (Admin)
    document.getElementById('btn-admin-exit')?.addEventListener('click', () => {
      navigate('landing');
    });

    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.adminTab = (btn as HTMLElement).dataset.tab as any;
        render();
      });
    });

    // Admin approve/reject
    document.querySelectorAll('.btn-approve-trx').forEach(btn => {
      btn.addEventListener('click', () => {
        state.paymentStatus = 'ready';
        alert('Payment verified! Full deck production unlocked.');
        render();
      });
    });

    document.querySelectorAll('.btn-reject-trx').forEach(btn => {
      btn.addEventListener('click', () => {
        state.paymentStatus = 'rejected';
        alert('Payment rejected with reason.');
        render();
      });
    });

    document.getElementById('btn-publish-draft')?.addEventListener('click', () => {
      alert('Draft v4 has been published to Live system instructions!');
    });

    document.getElementById('btn-rollback')?.addEventListener('click', () => {
      alert('Rollback to v2 successful.');
    });

    document.getElementById('btn-save-pricing')?.addEventListener('click', () => {
      alert('Pricing and soft-cap limits updated successfully!');
    });
  }

  // Initial render
  render();
}
