/**
 * Interactive 3D Canvas Visualizer using Three.js
 * Renders ambient floating 3D presentation cards and responsive particle constellations.
 */

import * as THREE from 'three';

export interface ThreeBackgroundController {
  destroy(): void;
  setAccentColor(hex: string): void;
}

export function initThreeBackground(canvasContainer: HTMLElement): ThreeBackgroundController {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
  camera.position.z = 24;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasContainer.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x006a4e, 2.5);
  dirLight.position.set(10, 15, 10);
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0xc8102e, 1.8, 50);
  pointLight.position.set(-10, -5, 8);
  scene.add(pointLight);

  // 1. Floating 3D Presentation Cards
  const cardsGroup = new THREE.Group();
  scene.add(cardsGroup);

  const cardGeo = new THREE.BoxGeometry(7, 4, 0.2);
  const cardMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x0b2b21,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x11140f,
      roughness: 0.2,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
    }),
  ];

  const cards: THREE.Mesh[] = [];
  const cardPositions = [
    { x: 7.5, y: 3.5, z: -2, rotZ: 0.08, rotY: -0.25 },
    { x: -8.0, y: -4.0, z: -4, rotZ: -0.12, rotY: 0.3 },
    { x: 9.0, y: -6.5, z: -6, rotZ: 0.05, rotY: -0.15 },
  ];

  cardPositions.forEach((pos, idx) => {
    const card = new THREE.Mesh(cardGeo, cardMaterials[idx % cardMaterials.length]);
    card.position.set(pos.x, pos.y, pos.z);
    card.rotation.set(0, pos.rotY, pos.rotZ);
    cardsGroup.add(card);
    cards.push(card);
  });

  // 2. Ambient Floating Particle Constellation
  const particleCount = 120;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const scales = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 45;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 35;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    scales[i] = Math.random() * 0.4 + 0.1;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particleMat = new THREE.PointsMaterial({
    color: 0x006a4e,
    size: 0.35,
    transparent: true,
    opacity: 0.6,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Mouse interaction
  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;

  function onMouseMove(e: MouseEvent) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  }
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  // Resize handler
  function onResize() {
    if (!canvasContainer) return;
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);

  let animationFrameId: number;
  let clock = new THREE.Clock();

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Lerp mouse
    targetX += (mouseX - targetX) * 0.05;
    targetY += (mouseY - targetY) * 0.05;

    // Gentle float on cards
    cards.forEach((card, i) => {
      card.position.y += Math.sin(elapsedTime * 1.2 + i * 1.5) * 0.005;
      card.rotation.x = targetY * 0.15;
      card.rotation.y = cardPositions[i].rotY + targetX * 0.2;
    });

    // Slow particles rotation
    particles.rotation.y = elapsedTime * 0.02 + targetX * 0.1;
    particles.rotation.x = targetY * 0.05;

    renderer.render(scene, camera);
  }

  animate();

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    },
    setAccentColor(hex: string) {
      dirLight.color.set(hex);
      particleMat.color.set(hex);
    },
  };
}
