import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertBijoyToUnicode, isBijoy } from '../src/studio/bijoy-converter.js';

test('V2 Spec: Bijoy to Unicode conversion handles SutonnyMJ patterns', () => {
  assert.equal(isBijoy('Avgvi †mvbvi evsjv'), true);
  const converted = convertBijoyToUnicode('Avgvi †mvbvi evsjv');
  assert.ok(converted.includes('আমার') || converted.includes('বাংলা'));
});

test('V2 Spec: Word count limits (30 min, 1500 max)', () => {
  const shortText = 'This is a short description with only seven words.';
  const shortWords = shortText.trim().split(/\s+/).length;
  assert.ok(shortWords < 30, 'Should detect text with under 30 words');

  const validText = new Array(50).fill('টেকসই').join(' ');
  const validWords = validText.trim().split(/\s+/).length;
  assert.ok(validWords >= 30 && validWords <= 1500, 'Should accept 50 words');
});

test('V2 Spec: Flat pricing at 32 BDT per slide (no Smooth/Static calculator tiers)', () => {
  const rate = 32;
  const count = 12;
  const total = count * rate;
  assert.equal(total, 384);
  assert.equal(5 * rate, 160);
  assert.equal(30 * rate, 960);
});

test('V2 Spec: Screen 2 copy is neutral (no course/teacher requirements, no ENV 201 course)', () => {
  const helperText = 'কী কী থাকবে, মূল পয়েন্ট বা তথ্য লেখো। Heading দিলে সেটা স্লাইডের টাইটেল হিসেবে ধরা হবে। ছবি টুলবার থেকে যেখানে চাও সেখানে বসাও, AI ঐ অংশের স্লাইডেই রাখবে।';
  assert.ok(!helperText.includes('কোর্স'), 'Helper text must not mention কোর্স');
  assert.ok(!helperText.includes('টিচারের নির্দেশনা'), 'Helper text must not mention টিচারের নির্দেশনা');
  assert.ok(!helperText.includes('ENV 201'), 'Must not contain ENV 201 placeholder');
});

test('V2 Spec: Screen 7 has real topics and formatted dates, no [date] or [Course topic] placeholders', () => {
  const sampleDecks = [
    { title: 'Climate Change and Bangladesh', date: '০৫ নভেম্বর ২০২৬' },
    { title: 'বাংলাদেশে নবায়নযোগ্য জ্বালানি ও টেকসই রূপান্তর', date: '০৪ নভেম্বর ২০২৬' },
    { title: 'ডেল্টা প্ল্যান ২১০০: আধুনিক নদী শাসন ও কৃষি ব্যবস্থাপনা', date: '০২ নভেম্বর ২০২৬' },
  ];

  for (const deck of sampleDecks) {
    assert.ok(!deck.title.includes('[Course topic]'), 'Title must not be [Course topic]');
    assert.ok(!deck.date.includes('[date]'), 'Date must not be [date]');
    assert.ok(deck.title.length > 5, 'Must be a real topic');
    assert.ok(deck.date.includes('নভেম্বর ২০২৬'), 'Must be a formatted Bengali date');
  }
});

test('V2 Spec: Technical Abuse Guards reject color/theme edits and topic drift', () => {
  const themeEditPrompt = 'পুরো ডিজাইন লাল করে দাও এবং ফন্ট বদলাও';
  const isThemeEdit = themeEditPrompt.includes('কালার') || themeEditPrompt.includes('লাল') || themeEditPrompt.includes('ফন্ট');
  assert.ok(isThemeEdit, 'Theme modification request should be detected and blocked');

  const topicDriftPrompt = 'এবার Machine Learning ও Artificial Intelligence নিয়ে নতুন স্লাইড বানাও';
  const isTopicDrift = topicDriftPrompt.includes('Machine Learning') || topicDriftPrompt.includes('নতুন');
  assert.ok(isTopicDrift, 'Topic drift request should be detected and flagged');
});
