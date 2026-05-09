(function (Drupal, once) {
  Drupal.behaviors.agCorrugationBox = {
    attach(context) {
      once('ag-corrugation-box', '[data-component="corrugation-box"]', context).forEach((component) => {
        const viewer = component.querySelector('[data-corrugation-viewer]');

        if (!viewer || typeof THREE === 'undefined') {
          return;
        }

        const widthInput = component.querySelector('[data-box-width]');
        const depthInput = component.querySelector('[data-box-depth]');
        const heightInput = component.querySelector('[data-box-height]');
        const openInput = component.querySelector('[data-box-open]');
        const materialInput = component.querySelector('[data-box-material]');
        const quantityInput = component.querySelector('[data-box-quantity]');

        const widthValue = component.querySelector('[data-box-width-value]');
        const depthValue = component.querySelector('[data-box-depth-value]');
        const heightValue = component.querySelector('[data-box-height-value]');
        const openValue = component.querySelector('[data-box-open-value]');
        const materialValue = component.querySelector('[data-box-material-value]');
        const quantityValue = component.querySelector('[data-box-quantity-value]');
        const materialSummary = component.querySelector('[data-box-material-summary]');
        const costValue = component.querySelector('[data-box-cost]');
        const quoteLink = component.querySelector('[data-box-quote-link]');

        let boxWidth = Number(viewer.dataset.width || 220);
        let boxDepth = Number(viewer.dataset.depth || 160);
        let boxHeight = Number(viewer.dataset.height || 140);
        let boxOpen = Number(viewer.dataset.open || 75);
        let boxMaterial = viewer.dataset.material || '5-ply-kraft';
        let boxQuantity = Number(viewer.dataset.quantity || 500);
        let isDragging = false;
        let previousPointerX = 0;
        let previousPointerY = 0;

        const quoteBaseUrl = viewer.dataset.quoteUrl || '/request-quote';
        const materials = {
          '3-ply-kraft': {
            label: '3-ply Kraft Board',
            shortLabel: '3-ply',
            rate: 0.78,
            color: 0xd28a3a,
          },
          '5-ply-kraft': {
            label: '5-ply Kraft Board',
            shortLabel: '5-ply',
            rate: 1,
            color: 0xc98338,
          },
          '7-ply-heavy': {
            label: '7-ply Heavy Duty Board',
            shortLabel: '7-ply',
            rate: 1.38,
            color: 0xa96528,
          },
          'white-board': {
            label: 'White Corrugated Board',
            shortLabel: 'White',
            rate: 1.18,
            color: 0xe9dcc8,
          },
        };

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
          45,
          viewer.clientWidth / viewer.clientHeight,
          0.1,
          3000
        );

        camera.position.set(380, 250, 430);
        camera.lookAt(0, 45, 0);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(viewer.clientWidth, viewer.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        viewer.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
        keyLight.position.set(240, 420, 260);
        keyLight.castShadow = true;
        scene.add(keyLight);

        const fillLight = new THREE.PointLight(0xffb86b, 0.8, 900);
        fillLight.position.set(-220, 180, 260);
        scene.add(fillLight);

        const floorGeometry = new THREE.PlaneGeometry(900, 900);
        const floorMaterial = new THREE.ShadowMaterial({
          opacity: 0.18,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -75;
        floor.receiveShadow = true;
        scene.add(floor);

        const boxGroup = new THREE.Group();
        boxGroup.rotation.set(-0.08, -0.45, 0);
        scene.add(boxGroup);

        const boardMaterial = new THREE.MeshStandardMaterial({
          color: 0xc98338,
          roughness: 0.86,
          metalness: 0.01,
        });

        const edgeMaterial = new THREE.LineBasicMaterial({
          color: 0x6b3d19,
          transparent: true,
          opacity: 0.42,
        });

        function disposeObject(object) {
          object.children.forEach(disposeObject);

          if (object.geometry) {
            object.geometry.dispose();
          }
        }

        function clearGroup(group) {
          while (group.children.length) {
            const object = group.children[0];

            disposeObject(object);
            group.remove(object);
          }
        }

        function addPanel(name, sizeX, sizeY, sizeZ, posX, posY, posZ) {
          const panelGroup = new THREE.Group();
          const geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
          const panel = new THREE.Mesh(geometry, boardMaterial);

          panel.name = name;
          panel.castShadow = true;
          panel.receiveShadow = true;

          const edge = new THREE.EdgesGeometry(geometry);
          const edgeLines = new THREE.LineSegments(edge, edgeMaterial);

          panelGroup.name = name;
          panelGroup.position.set(posX, posY, posZ);
          panelGroup.add(panel);
          panelGroup.add(edgeLines);
          boxGroup.add(panelGroup);

          return panelGroup;
        }

        function addFlap(name, sizeX, sizeZ, hingeX, hingeY, hingeZ, openRotation, axis, layerOffset = 0) {
          const flapGroup = new THREE.Group();
          const geometry = new THREE.BoxGeometry(sizeX, 5, sizeZ);
          const flap = new THREE.Mesh(geometry, boardMaterial);
          const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);

          flap.castShadow = true;
          flap.receiveShadow = true;

          if (axis === 'x-front') {
            flap.position.z = -sizeZ / 2;
            edge.position.z = -sizeZ / 2;
            flapGroup.rotation.x = openRotation;
          }
          else if (axis === 'x-back') {
            flap.position.z = sizeZ / 2;
            edge.position.z = sizeZ / 2;
            flapGroup.rotation.x = openRotation;
          }
          else if (axis === 'z-left') {
            flap.position.x = sizeX / 2;
            edge.position.x = sizeX / 2;
            flapGroup.rotation.z = openRotation;
          }
          else if (axis === 'z-right') {
            flap.position.x = -sizeX / 2;
            edge.position.x = -sizeX / 2;
            flapGroup.rotation.z = openRotation;
          }

          flapGroup.name = name;
          flapGroup.position.set(hingeX, hingeY + layerOffset, hingeZ);
          flapGroup.add(flap);
          flapGroup.add(edge);
          boxGroup.add(flapGroup);

          return flapGroup;
        }

        function buildBox() {
          clearGroup(boxGroup);

          const scale = 0.88;
          const w = boxWidth * scale;
          const d = boxDepth * scale;
          const h = boxHeight * scale * 0.9;
          const t = 5;
          const baseY = -h / 2;
          const midY = baseY + h / 2;
          const topY = baseY + h;

          // Main carton walls.
          addPanel('front', w, h, t, 0, midY, d / 2);
          addPanel('back', w, h, t, 0, midY, -d / 2);
          addPanel('left', t, h, d, -w / 2, midY, 0);
          addPanel('right', t, h, d, w / 2, midY, 0);
          addPanel('bottom', w, t, d, 0, baseY, 0);

          // Partially opened top flaps.
          const endFlapLength = d * 0.52;
          const sideFlapLength = w * 0.5;
          const openProgress = clamp(boxOpen / 100, 0, 1);

          // Closing order: side flaps close first, then front/back flaps close over them.
          const sideOpenProgress = clamp((openProgress - 0.5) * 2, 0, 1);
          const endOpenProgress = clamp(openProgress * 2, 0, 1);
          const sideFlapRotation = sideOpenProgress * 2.08;
          const endFlapRotation = endOpenProgress * 2.18;
          const topLayerLift = (1 - endOpenProgress) * 6;

          addFlap('left-flap', sideFlapLength, d, -w / 2, topY, 0, sideFlapRotation, 'z-left');
          addFlap('right-flap', sideFlapLength, d, w / 2, topY, 0, -sideFlapRotation, 'z-right');
          addFlap('front-flap', w, endFlapLength, 0, topY, d / 2, endFlapRotation, 'x-front', topLayerLift);
          addFlap('back-flap', w, endFlapLength, 0, topY, -d / 2, -endFlapRotation, 'x-back', topLayerLift);

          // Center model.
          boxGroup.position.y = 12;
        }

        function updateLabels() {
          const selectedMaterial = materials[boxMaterial] || materials['5-ply-kraft'];

          if (widthValue) {
            widthValue.textContent = `${boxWidth} mm`;
          }
          if (depthValue) {
            depthValue.textContent = `${boxDepth} mm`;
          }
          if (heightValue) {
            heightValue.textContent = `${boxHeight} mm`;
          }
          if (openValue) {
            openValue.textContent = `${boxOpen}%`;
          }
          if (materialValue) {
            materialValue.textContent = selectedMaterial.shortLabel;
          }
          if (quantityValue) {
            quantityValue.textContent = boxQuantity.toLocaleString();
          }
          if (materialSummary) {
            materialSummary.textContent = selectedMaterial.label;
          }
          boardMaterial.color.setHex(selectedMaterial.color);
          updateEstimate(selectedMaterial);
          updateQuoteLink(selectedMaterial);
        }

        function updateEstimate(selectedMaterial) {
          if (!costValue) {
            return;
          }

          const surfaceArea = 2 * ((boxWidth * boxDepth) + (boxWidth * boxHeight) + (boxDepth * boxHeight));
          const squareMeters = surfaceArea / 1000000;
          const baseUnitCost = squareMeters * 18 * selectedMaterial.rate;
          const setupCost = 450;
          const quantityDiscount = boxQuantity >= 2000 ? 0.86 : boxQuantity >= 1000 ? 0.92 : 1;
          const estimatedTotal = (baseUnitCost * boxQuantity * quantityDiscount) + setupCost;
          const low = Math.max(0, Math.round(estimatedTotal * 0.9));
          const high = Math.round(estimatedTotal * 1.12);

          costValue.textContent = `₹${low.toLocaleString()} - ₹${high.toLocaleString()}`;
        }

        function updateQuoteLink(selectedMaterial) {
          if (!quoteLink) {
            return;
          }

          const url = new URL(quoteBaseUrl, window.location.origin);
          url.searchParams.set('width', boxWidth);
          url.searchParams.set('depth', boxDepth);
          url.searchParams.set('height', boxHeight);
          url.searchParams.set('material', selectedMaterial.label);
          url.searchParams.set('quantity', boxQuantity);

          quoteLink.href = url.origin === window.location.origin ? `${url.pathname}${url.search}` : url.href;
        }

        function onInputChange() {
          boxWidth = Number(widthInput.value);
          boxDepth = Number(depthInput.value);
          boxHeight = Number(heightInput.value);
          boxOpen = Number(openInput.value);
          boxMaterial = materialInput.value;
          boxQuantity = Math.max(100, Number(quantityInput.value || 100));

          updateLabels();
          buildBox();
        }

        if (widthInput && depthInput && heightInput && openInput && materialInput && quantityInput) {
          widthInput.addEventListener('input', onInputChange);
          depthInput.addEventListener('input', onInputChange);
          heightInput.addEventListener('input', onInputChange);
          openInput.addEventListener('input', onInputChange);
          materialInput.addEventListener('change', onInputChange);
          quantityInput.addEventListener('input', onInputChange);
        }

        function handleResize() {
          const width = viewer.clientWidth;
          const height = viewer.clientHeight;

          camera.aspect = width / height;
          camera.updateProjectionMatrix();

          renderer.setSize(width, height);
        }

        window.addEventListener('resize', handleResize);

        function clamp(value, min, max) {
          return Math.min(Math.max(value, min), max);
        }

        function setDragging(active) {
          isDragging = active;
          viewer.classList.toggle('is-dragging', active);
        }

        viewer.addEventListener('pointerdown', (event) => {
          setDragging(true);
          previousPointerX = event.clientX;
          previousPointerY = event.clientY;
          viewer.setPointerCapture(event.pointerId);
        });

        viewer.addEventListener('pointermove', (event) => {
          if (!isDragging) {
            return;
          }

          const deltaX = event.clientX - previousPointerX;
          const deltaY = event.clientY - previousPointerY;

          boxGroup.rotation.y += deltaX * 0.01;
          boxGroup.rotation.x = clamp(boxGroup.rotation.x + deltaY * 0.006, -0.55, 0.35);

          previousPointerX = event.clientX;
          previousPointerY = event.clientY;
        });

        viewer.addEventListener('pointerup', (event) => {
          setDragging(false);

          if (viewer.hasPointerCapture(event.pointerId)) {
            viewer.releasePointerCapture(event.pointerId);
          }
        });

        viewer.addEventListener('pointercancel', () => {
          setDragging(false);
        });

        viewer.addEventListener('lostpointercapture', () => {
          setDragging(false);
        });

        function animate() {
          requestAnimationFrame(animate);

          renderer.render(scene, camera);
        }

        updateLabels();
        buildBox();
        animate();
      });
    },
  };
})(Drupal, once);
