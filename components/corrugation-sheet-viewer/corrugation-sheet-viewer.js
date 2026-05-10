(function (Drupal, once) {
  const instances = new WeakMap();

  Drupal.behaviors.agCorrugationSheetViewer = {
    attach(context) {
      once('ag-corrugation-sheet-viewer', '[data-component="corrugation-sheet-viewer"]', context).forEach((component) => {
        const viewer = component.querySelector('[data-corrugation-sheet-viewer]');

        if (!viewer) {
          return;
        }

        if (typeof THREE === 'undefined') {
          component.classList.add('is-unavailable');
          return;
        }

        const selectedPly = component.querySelector('[data-selected-ply]');
        const plyDetails = component.querySelector('[data-ply-details]');
        const plyButtons = component.querySelectorAll('[data-ply]');
        const plySelect = component.querySelector('[data-ply-select]');
        let renderer = null;
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-3, 3, 1.8, -1.8, 0.1, 100);
        const sheetGroup = new THREE.Group();
        const boardTypes = {
          3: {
            linerCount: 2,
            description: 'Structure: 2 liners with 1 corrugated medium.',
          },
          5: {
            linerCount: 3,
            description: 'Structure: 3 liners with 2 corrugated mediums.',
          },
          7: {
            linerCount: 4,
            description: 'Structure: 4 liners with 3 corrugated mediums.',
          },
        };

        let currentPly = component.dataset.defaultPly || '3';
        let animationFrame = null;
        let isDragging = false;
        let previousPointerX = 0;
        let previousPointerY = 0;
        let rotationX = 0;
        let rotationY = -0.08;
        const rotationZ = 0;
        let autoCenterRotationY = -0.08;
        let autoPhase = 0;
        let resizeObserver = null;
        let intersectionObserver = null;
        let isVisible = true;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const controller = new AbortController();
        const listenerOptions = { signal: controller.signal };

        // Scene units are visual, but this scale keeps sheet dimensions traceable.
        // With the current camera framing, 1 mm equals 0.03 Three.js units.
        const mmToSceneUnit = 0.03;
        const linerThicknessMm = 1;
        const linerThickness = linerThicknessMm * mmToSceneUnit;

        // Distance between liner centerlines. The flute wave touches the liner faces,
        // so the visible flute height is this gap minus one liner thickness.
        const mediumGap = 0.25;
        const sheetWidth = 2.8;
        const sheetDepth = 1.25;
        const fluteWidth = 2.65;
        const fluteDepth = 1.12;
        const linerMaterials = [
          new THREE.MeshStandardMaterial({
            color: 0xcd9f61,
            roughness: 0.65,
            metalness: 0.02,
          }),
          new THREE.MeshStandardMaterial({
            color: 0xc08f4f,
            roughness: 0.65,
            metalness: 0.02,
          }),
        ];
        const fluteMaterial = new THREE.MeshStandardMaterial({
          color: 0xc08f4f,
          roughness: 0.7,
          metalness: 0.01,
          side: THREE.DoubleSide,
        });
        const fluteEdgeMaterial = new THREE.MeshStandardMaterial({
          color: 0xa97835,
          roughness: 0.75,
        });

        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        }
        catch (error) {
          component.classList.add('is-unavailable');
          return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.setAttribute('aria-hidden', 'true');
        viewer.appendChild(renderer.domElement);
        viewer.classList.add('is-ready');

        camera.position.set(0, 0.65, 7);
        camera.lookAt(0, 0, 0);

        scene.add(new THREE.HemisphereLight(0xffffff, 0xd8b27c, 0.72));

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(3.5, 5, 4);
        scene.add(keyLight);
        scene.add(sheetGroup);

        function normalizePly(ply) {
          return ply === '6' ? '7' : ply;
        }

        function disposeObject(object) {
          object.traverse((child) => {
            if (child.geometry) {
              child.geometry.dispose();
            }
          });
        }

        function createLiner(y, materialIndex) {
          const geometry = new THREE.BoxGeometry(sheetWidth, linerThickness, sheetDepth);
          const mesh = new THREE.Mesh(geometry, linerMaterials[materialIndex % linerMaterials.length]);
          mesh.position.y = y;
          return mesh;
        }

        function getFluteY(x, width, topY, bottomY) {
          const fluteCount = 8;
          const centerY = (topY + bottomY) / 2;
          const amplitude = (topY - bottomY) / 2;
          const progress = (x + width / 2) / width;

          return centerY + Math.sin(progress * Math.PI * 2 * fluteCount) * amplitude;
        }

        function createFlute(topY, bottomY) {
          const group = new THREE.Group();
          const segmentsX = 128;
          const segmentsZ = 10;
          const vertices = [];
          const indices = [];

          // Build one continuous corrugated medium sheet. X follows the sine wave,
          // Z extrudes it through the board depth, like a real fluted paper layer.
          for (let zIndex = 0; zIndex <= segmentsZ; zIndex++) {
            const z = -fluteDepth / 2 + (fluteDepth * zIndex) / segmentsZ;

            for (let xIndex = 0; xIndex <= segmentsX; xIndex++) {
              const x = -fluteWidth / 2 + (fluteWidth * xIndex) / segmentsX;
              vertices.push(x, getFluteY(x, fluteWidth, topY, bottomY), z);
            }
          }

          for (let zIndex = 0; zIndex < segmentsZ; zIndex++) {
            for (let xIndex = 0; xIndex < segmentsX; xIndex++) {
              const row = segmentsX + 1;
              const a = zIndex * row + xIndex;
              const b = a + 1;
              const c = a + row;
              const d = c + 1;
              indices.push(a, c, b, b, c, d);
            }
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          group.add(new THREE.Mesh(geometry, fluteMaterial));

          // Darker front/back edges make the cutaway profile readable without
          // turning every flute into a heavy tube.
          [-fluteDepth / 2, fluteDepth / 2].forEach((z) => {
            const points = [];

            for (let i = 0; i <= 120; i++) {
              const x = -fluteWidth / 2 + (fluteWidth * i) / 120;
              const waveY = getFluteY(x, fluteWidth, topY, bottomY);
              points.push(new THREE.Vector3(x, waveY, z));
            }

            const curve = new THREE.CatmullRomCurve3(points);
            const edgeGeometry = new THREE.TubeGeometry(curve, 120, 0.011, 8, false);
            group.add(new THREE.Mesh(edgeGeometry, fluteEdgeMaterial));
          });

          return group;
        }

        function getLinerPositions(linerCount) {
          const totalHeight = mediumGap * (linerCount - 1);
          const top = totalHeight / 2;
          const liners = [];

          for (let i = 0; i < linerCount; i++) {
            liners.push(top - i * mediumGap);
          }

          return liners;
        }

        function renderSheet(ply) {
          // Ply switching rebuilds geometry, so dispose old buffers first to avoid
          // leaking WebGL memory during repeated 3/5/7-ply toggles.
          sheetGroup.children.forEach(disposeObject);
          sheetGroup.clear();

          const boardType = boardTypes[ply] || boardTypes[3];
          const liners = getLinerPositions(boardType.linerCount);

          liners.forEach((y, index) => {
            sheetGroup.add(createLiner(y, index));
          });

          for (let i = 0; i < liners.length - 1; i++) {
            // Contact points are the liner faces, not the liner centerlines.
            const upperLinerBottom = liners[i] - linerThickness / 2;
            const lowerLinerTop = liners[i + 1] + linerThickness / 2;
            sheetGroup.add(createFlute(upperLinerBottom, lowerLinerTop));
          }

          sheetGroup.rotation.set(rotationX, rotationY, rotationZ);
        }

        function updatePly(ply) {
          currentPly = normalizePly(String(ply || '3'));
          currentPly = boardTypes[currentPly] ? currentPly : '3';
          if (selectedPly) {
            selectedPly.textContent = currentPly;
          }
          if (plyDetails) {
            plyDetails.textContent = boardTypes[currentPly].description;
          }
          if (plySelect) {
            plySelect.value = currentPly;
          }
          plyButtons.forEach((button) => {
            const isActive = button.dataset.ply === currentPly;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          });
          renderSheet(currentPly);
        }

        function resize() {
          const width = viewer.clientWidth;
          const height = viewer.clientHeight;

          if (!width || !height) {
            return;
          }

          const aspect = width / height;
          const viewHeight = Math.max(1.7, 4.2 / aspect);
          const viewWidth = viewHeight * aspect;

          camera.left = -viewWidth / 2;
          camera.right = viewWidth / 2;
          camera.top = viewHeight / 2;
          camera.bottom = -viewHeight / 2;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        }

        function animate() {
          if (isVisible) {
            if (!isDragging && !prefersReducedMotion.matches) {
              autoPhase += 0.015;
              rotationY = autoCenterRotationY + Math.sin(autoPhase) * 0.12;
              sheetGroup.rotation.y = rotationY;
            }

            renderer.render(scene, camera);
          }

          animationFrame = requestAnimationFrame(animate);
        }

        function setDragging(active) {
          isDragging = active;
          viewer.classList.toggle('is-dragging', active);
        }

        plyButtons.forEach((button) => {
          button.addEventListener('click', () => updatePly(button.dataset.ply), listenerOptions);
        });

        if (plySelect) {
          plySelect.addEventListener('change', () => updatePly(plySelect.value), listenerOptions);
        }

        viewer.addEventListener('pointerdown', (event) => {
          setDragging(true);
          previousPointerX = event.clientX;
          previousPointerY = event.clientY;
          viewer.setPointerCapture(event.pointerId);
        }, listenerOptions);

        viewer.addEventListener('pointermove', (event) => {
          if (!isDragging) {
            return;
          }

          const deltaX = event.clientX - previousPointerX;
          const deltaY = event.clientY - previousPointerY;

          rotationY += deltaX * 0.008;
          rotationX += deltaY * 0.006;
          rotationX = Math.max(-1.1, Math.min(0.7, rotationX));
          sheetGroup.rotation.set(rotationX, rotationY, rotationZ);

          previousPointerX = event.clientX;
          previousPointerY = event.clientY;
        }, listenerOptions);

        viewer.addEventListener('pointerup', (event) => {
          autoCenterRotationY = rotationY;
          setDragging(false);

          if (viewer.hasPointerCapture(event.pointerId)) {
            viewer.releasePointerCapture(event.pointerId);
          }
        }, listenerOptions);

        viewer.addEventListener('pointercancel', () => {
          setDragging(false);
        }, listenerOptions);

        viewer.addEventListener('lostpointercapture', () => {
          setDragging(false);
        }, listenerOptions);

        viewer.addEventListener('keydown', (event) => {
          const keyActions = {
            ArrowLeft: () => {
              rotationY -= 0.12;
            },
            ArrowRight: () => {
              rotationY += 0.12;
            },
            ArrowUp: () => {
              rotationX = Math.max(-1.1, rotationX - 0.1);
            },
            ArrowDown: () => {
              rotationX = Math.min(0.7, rotationX + 0.1);
            },
            Home: () => {
              rotationX = 0;
              rotationY = -0.08;
            },
          };

          if (!keyActions[event.key]) {
            return;
          }

          event.preventDefault();
          keyActions[event.key]();
          autoCenterRotationY = rotationY;
          sheetGroup.rotation.set(rotationX, rotationY, rotationZ);
          renderer.render(scene, camera);
        }, listenerOptions);

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(viewer);
        }
        else {
          window.addEventListener('resize', resize, listenerOptions);
        }

        if (typeof IntersectionObserver !== 'undefined') {
          intersectionObserver = new IntersectionObserver((entries) => {
            isVisible = entries.some((entry) => entry.isIntersecting);
          });
          intersectionObserver.observe(component);
        }

        resize();
        updatePly(currentPly);
        animate();

        instances.set(component, () => {
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
          }
          controller.abort();
          if (resizeObserver) {
            resizeObserver.disconnect();
          }
          if (intersectionObserver) {
            intersectionObserver.disconnect();
          }
          sheetGroup.children.forEach(disposeObject);
          sheetGroup.clear();
          linerMaterials.forEach((material) => material.dispose());
          fluteMaterial.dispose();
          fluteEdgeMaterial.dispose();
          renderer.dispose();
          viewer.classList.remove('is-ready');
          if (renderer.domElement.parentNode === viewer) {
            viewer.removeChild(renderer.domElement);
          }
          instances.delete(component);
        });
      });
    },

    detach(context, settings, trigger) {
      if (trigger !== 'unload') {
        return;
      }

      const components = context.matches && context.matches('[data-component="corrugation-sheet-viewer"]')
        ? [context]
        : context.querySelectorAll('[data-component="corrugation-sheet-viewer"]');

      components.forEach((component) => {
        const destroy = instances.get(component);

        if (destroy) {
          destroy();
        }
      });
    },
  };
})(Drupal, once);
