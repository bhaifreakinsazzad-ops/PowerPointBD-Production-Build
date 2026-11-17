import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PresentationContent } from '../../../shared/presentation.ts';

/** A draft navigation surface, never a simulation of native PowerPoint effects. */
export function createStoryboard(host: HTMLElement, document: PresentationContent, selectSlide: (index: number) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#0B2B21');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D draft storyboard. Drag to orbit, scroll to zoom. Use slide buttons below for keyboard selection.');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0B2B21', 0.032);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
  camera.position.set(0, 3.2, 8.8);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 4;
  controls.maxDistance = 18;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI * 0.72;

  scene.add(new THREE.HemisphereLight('#E3EEE8', '#0B2B21', 3.0));
  const key = new THREE.DirectionalLight('#FFFFFF', 4.5);
  key.position.set(4, 6, 7);
  scene.add(key);

  const rim = new THREE.PointLight('#7FE0BC', 6, 22);
  rim.position.set(-6, 3, -3);
  scene.add(rim);

  const grid = new THREE.GridHelper(28, 28, '#7FE0BC', '#0F3528');
  grid.position.y = -3.8;
  scene.add(grid);

  // Subtle ambient starfield motes for spatial depth
  const particleCount = 120;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = ((i * 73) % 24) - 12;
    positions[i * 3 + 1] = ((i * 41) % 14) - 5;
    positions[i * 3 + 2] = -(((i * 29) % 10) + 1.5);
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ color: '#7FE0BC', size: 0.065, transparent: true, opacity: 0.5 });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.BoxGeometry(3.2, 1.8, 0.07);
  const baseEdge = new THREE.MeshStandardMaterial({ color: '#0F3528', roughness: 0.6, metalness: 0.15 });
  const activeEdge = new THREE.MeshStandardMaterial({ color: '#7FE0BC', emissive: '#006A4E', emissiveIntensity: 0.55, roughness: 0.35 });
  const cards: THREE.Mesh[] = [];
  const textures: THREE.CanvasTexture[] = [];
  const materials: THREE.MeshPhysicalMaterial[] = [];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 0, hovered = -1, disposed = false, visible = true, active = true;

  for (const [index, slide] of document.slides.entries()) {
    const canvas = window.document.createElement('canvas');
    const scale = window.innerWidth < 680 || document.slides.length > 12 ? 0.5 : 1;
    canvas.width = 1024 * scale;
    canvas.height = 576 * scale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CANVAS_UNAVAILABLE');
    context.scale(scale, scale);

    // Executive slide surface with subtle gradient and top accent bar
    const bgGrad = context.createLinearGradient(0, 0, 1024, 576);
    bgGrad.addColorStop(0, '#FFFFFF');
    bgGrad.addColorStop(1, '#F6F4EE');
    context.fillStyle = bgGrad;
    context.fillRect(0, 0, 1024, 576);

    const barGrad = context.createLinearGradient(0, 0, 1024, 0);
    barGrad.addColorStop(0, '#006A4E');
    barGrad.addColorStop(0.7, '#0B2B21');
    barGrad.addColorStop(1, '#C8102E');
    context.fillStyle = barGrad;
    context.fillRect(0, 0, 1024, 12);

    // Slide header pill & metadata
    context.fillStyle = '#E3EEE8';
    context.fillRect(52, 34, 134, 34);
    context.fillStyle = '#006A4E';
    context.font = 'bold 18px "Bricolage Grotesque", "Nirmala UI", sans-serif';
    context.fillText(`SLIDE ${String(index + 1).padStart(2, '0')}`, 68, 57);

    const dense = slide.bullets.length > 6;
    context.fillStyle = dense ? '#fef3c7' : '#E3EEE8';
    context.fillRect(200, 34, 210, 34);
    context.fillStyle = dense ? '#b45309' : '#006A4E';
    context.font = '600 16px "Bricolage Grotesque", "Hind Siliguri", sans-serif';
    context.fillText(`${slide.bullets.length} bullets · ${document.language.toUpperCase()}`, 216, 56);

    const wrap = (value: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) => {
      // Keep Bengali combining marks together; never interpret content as HTML.
      let line = '', lines = 0;
      const segments = new Intl.Segmenter(document.language === 'en' ? 'en' : 'bn', { granularity: 'grapheme' }).segment(value);
      for (const { segment: char } of segments) {
        if (context.measureText(line + char).width > width) {
          context.fillText(line, x, y);
          y += lineHeight;
          line = '';
          lines++;
          if (lines >= maxLines) return y;
        }
        line += char;
      }
      if (line) {
        context.fillText(line, x, y);
        y += lineHeight;
      }
      return y;
    };

    context.fillStyle = '#11140F';
    context.font = 'bold 40px "Bricolage Grotesque", "Hind Siliguri", "Nirmala UI", sans-serif';
    const bottom = wrap(slide.title, 54, 126, 915, 48, 2);

    context.font = '24px "Hind Siliguri", "Nirmala UI", sans-serif';
    let y = bottom + 32;
    for (const bullet of slide.bullets.slice(0, 4)) {
      if (y > 500) break;
      context.fillStyle = '#C8102E';
      context.beginPath();
      context.arc(58, y - 8, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#4A5148';
      y = wrap(bullet, 74, y, 885, 36, 2) + 14;
    }

    // Bottom footer bar
    context.fillStyle = '#e2e8f0';
    context.fillRect(0, 534, 1024, 42);
    context.fillStyle = '#475569';
    context.font = '16px sans-serif';
    context.fillText(
      slide.notes?.trim() ? 'Speaker notes included · Ready for static preview' : 'Draft slide · Click card in 3D to inspect & edit',
      54,
      560,
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);

    const face = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.68, metalness: 0.02, clearcoat: 0.14 });
    materials.push(face);

    const card = new THREE.Mesh(geometry, [baseEdge, baseEdge, baseEdge, baseEdge, face, baseEdge]);
    card.position.set(((index % 3) - 1) * 3.65, -Math.floor(index / 3) * 2.25, 0);
    card.userData.slideIndex = index;
    group.add(card);
    cards.push(card);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = { x: 0, y: 0 };

  const syncCardVisuals = () => {
    cards.forEach((card, i) => {
      const isSelected = i === selected;
      const isHovered = i === hovered;
      card.scale.setScalar(isSelected ? 1.06 : isHovered ? 1.025 : 1);
      card.position.z = isSelected ? 0.28 : isHovered ? 0.1 : 0;
      const edgeMat = isSelected ? activeEdge : baseEdge;
      const faceMat = materials[i]!;
      card.material = [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, edgeMat];
    });
  };

  const start = (event: PointerEvent) => {
    down = { x: event.clientX, y: event.clientY };
  };
  const move = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(cards)[0];
    const nextHover = hit ? (hit.object.userData.slideIndex as number) : -1;
    if (nextHover !== hovered) {
      hovered = nextHover;
      renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : 'grab';
      syncCardVisuals();
      render();
    }
  };
  const pick = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(cards)[0];
    if (hit) selectSlide(hit.object.userData.slideIndex as number);
  };

  renderer.domElement.addEventListener('pointerdown', start);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', pick);

  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  let tick = 0;
  const render = () => {
    if (disposed || !active || !visible || window.document.hidden) return;
    if (!motion.matches) {
      tick += 0.008;
      particles.rotation.y = tick * 0.15;
    }
    controls.update();
    renderer.render(scene, camera);
  };

  const syncLoop = () => {
    renderer.setAnimationLoop(!disposed && active && visible && !window.document.hidden && !motion.matches ? render : null);
  };
  const visibility = () => syncLoop();
  window.document.addEventListener('visibilitychange', visibility);

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    syncLoop();
  });
  observer.observe(host);

  const reduce = () => {
    if (motion.matches) controls.autoRotate = false;
    controls.enableDamping = !motion.matches;
    syncLoop();
    render();
  };
  motion.addEventListener('change', reduce);

  const lost = (event: Event) => {
    event.preventDefault();
    active = false;
    renderer.setAnimationLoop(null);
    host.dispatchEvent(new Event('storyboard-unavailable'));
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);

  const choose = (index: number) => {
    selected = index;
    syncCardVisuals();
    const row = Math.floor(index / 3);
    group.position.y = row * 2.25;
    controls.target.set(0, 0, 0);
    controls.update();
    render();
  };

  const draw = () => {
    if (!disposed && active && visible && !window.document.hidden) renderer.render(scene, camera);
  };
  controls.addEventListener('change', draw);
  choose(0);
  reduce();

  return {
    select: choose,
    autoRotate(enabled: boolean) {
      controls.autoRotate = enabled && !motion.matches;
    },
    reset() {
      camera.position.set(0, 3.2, 8.8);
      controls.target.set(0, 0, 0);
      controls.update();
      render();
    },
    pause(paused: boolean) {
      active = !paused;
      syncLoop();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      observer.disconnect();
      window.document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', reduce);
      renderer.domElement.removeEventListener('pointerdown', start);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', pick);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      controls.removeEventListener('change', draw);
      controls.dispose();
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      baseEdge.dispose();
      activeEdge.dispose();
      geometry.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      grid.geometry.dispose();
      if (Array.isArray(grid.material)) grid.material.forEach((m) => m.dispose());
      else grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
