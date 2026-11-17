/**
 * Motion & Animation Controller using Anime.js and Motion (motion.dev)
 * Provides 60fps micro-interactions, rolling numeric counters, and spring physics.
 */

import { animate as animeAnimate, stagger } from 'animejs';
import { animate as motionAnimate, spring } from 'motion';

export function animateNumber(
  element: HTMLElement,
  from: number,
  to: number,
  prefix: string = '৳',
  suffix: string = ''
): void {
  const obj = { val: from };
  animeAnimate(obj, {
    val: to,
    duration: 650,
    ease: 'outExpo',
    onUpdate: () => {
      const rounded = Math.round(obj.val);
      // Bengali numeral converter for aesthetic BDT figures
      const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
      const bnStr = String(rounded).replace(/[0-9]/g, d => bnDigits[Number(d)]);
      element.textContent = `${prefix}${bnStr}${suffix}`;
    },
  });
}

export function animateScreenEnter(element: HTMLElement): void {
  element.style.opacity = '0';
  element.style.transform = 'translateY(16px)';
  element.hidden = false;

  motionAnimate(
    element,
    { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] },
    { duration: 0.35, easing: spring({ stiffness: 350, damping: 25 }) }
  );
}

export function staggerEntrance(selector: string | HTMLElement[]): void {
  const targets = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
  if (!targets || targets.length === 0) return;

  animeAnimate(targets, {
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 450,
    delay: stagger(60),
    ease: 'outQuad',
  });
}

export function buttonRipple(btn: HTMLElement, e: MouseEvent): void {
  const rect = btn.getBoundingClientRect();
  const circle = document.createElement('span');
  const diameter = Math.max(btn.clientWidth, btn.clientHeight);
  const radius = diameter / 2;

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${e.clientX - rect.left - radius}px`;
  circle.style.top = `${e.clientY - rect.top - radius}px`;
  circle.className = 'btn-ripple-wave';

  btn.appendChild(circle);

  animeAnimate(circle, {
    scale: [0, 2.5],
    opacity: [0.4, 0],
    duration: 600,
    ease: 'outQuad',
    onComplete: () => circle.remove(),
  });
}

export function shakeElement(el: HTMLElement): void {
  animeAnimate(el, {
    translateX: [-8, 8, -6, 6, -3, 3, 0],
    duration: 400,
    ease: 'easeInOutSine',
  });
}

export function pulseBeacon(el: HTMLElement): void {
  animeAnimate(el, {
    scale: [1, 1.25, 1],
    opacity: [1, 0.7, 1],
    duration: 1800,
    loop: true,
    ease: 'easeInOutQuad',
  });
}
