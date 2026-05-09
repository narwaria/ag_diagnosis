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
        const unitInput = component.querySelector('[data-box-unit]');
        const materialInput = component.querySelector('[data-box-material]');
        const typeInput = component.querySelector('[data-box-type]');
        const printInput = component.querySelector('[data-box-print]');
        const quantityInput = component.querySelector('[data-box-quantity]');
        const presetButtons = component.querySelectorAll('[data-box-preset]');

        const widthValue = component.querySelector('[data-box-width-value]');
        const depthValue = component.querySelector('[data-box-depth-value]');
        const heightValue = component.querySelector('[data-box-height-value]');
        const openValue = component.querySelector('[data-box-open-value]');
        const unitValue = component.querySelector('[data-box-unit-value]');
        const materialValue = component.querySelector('[data-box-material-value]');
        const typeValue = component.querySelector('[data-box-type-value]');
        const printValue = component.querySelector('[data-box-print-value]');
        const quantityValue = component.querySelector('[data-box-quantity-value]');
        const strengthValue = component.querySelector('[data-box-strength]');
        const volumeValue = component.querySelector('[data-box-volume]');
        const payloadValue = component.querySelector('[data-box-payload]');
        const costValue = component.querySelector('[data-box-cost]');
        const quoteLink = component.querySelector('[data-box-quote-link]');

        let boxWidth = Number(viewer.dataset.width || 220);
        let boxDepth = Number(viewer.dataset.depth || 160);
        let boxHeight = Number(viewer.dataset.height || 140);
        let boxOpen = Number(viewer.dataset.open || 75);
        let boxUnit = viewer.dataset.unit || 'mm';
        let boxMaterial = viewer.dataset.material || '5-ply-kraft';
        let boxType = viewer.dataset.boxType || 'rsc';
        let printOption = viewer.dataset.print || 'plain';
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
            strength: 1,
          },
          '5-ply-kraft': {
            label: '5-ply Kraft Board',
            shortLabel: '5-ply',
            rate: 1,
            color: 0xc98338,
            strength: 2,
          },
          '7-ply-heavy': {
            label: '7-ply Heavy Duty Board',
            shortLabel: '7-ply',
            rate: 1.38,
            color: 0xa96528,
            strength: 3,
          },
          'white-board': {
            label: 'White Corrugated Board',
            shortLabel: 'White',
            rate: 1.18,
            color: 0xe9dcc8,
            strength: 1.6,
          },
        };

        const boxTypes = {
          rsc: {
            label: 'Regular Slotted Carton',
            shortLabel: 'RSC',
            rate: 1,
            strength: 1,
            endFlapRatio: 0.52,
            sideFlapRatio: 0.5,
          },
          mailer: {
            label: 'Mailer Box',
            shortLabel: 'Mailer',
            rate: 1.16,
            strength: 0.85,
            endFlapRatio: 0.68,
            sideFlapRatio: 0.58,
          },
          'die-cut': {
            label: 'Die-cut Box',
            shortLabel: 'Die-cut',
            rate: 1.28,
            strength: 0.95,
            endFlapRatio: 0.6,
            sideFlapRatio: 0.54,
          },
          'half-slotted': {
            label: 'Half-slotted Carton',
            shortLabel: 'HSC',
            rate: 0.92,
            strength: 0.9,
            endFlapRatio: 0.44,
            sideFlapRatio: 0.44,
          },
        };

        const printOptions = {
          plain: {
            label: 'Plain',
            shortLabel: 'Plain',
            rate: 1,
            setup: 0,
          },
          'one-color': {
            label: '1-color Print',
            shortLabel: '1C',
            rate: 1.12,
            setup: 650,
          },
          'two-color': {
            label: '2-color Print',
            shortLabel: '2C',
            rate: 1.2,
            setup: 1100,
          },
          'full-color': {
            label: 'Full Color Print',
            shortLabel: 'Full',
            rate: 1.36,
            setup: 1800,
          },
        };

        const units = {
          mm: {
            label: 'mm',
            precision: 0,
            fromMm(value) {
              return value;
            },
          },
          cm: {
            label: 'cm',
            precision: 1,
            fromMm(value) {
              return value / 10;
            },
          },
          in: {
            label: 'in',
            precision: 1,
            fromMm(value) {
              return value / 25.4;
            },
          },
        };

        const presets = {
          small: {
            width: 180,
            depth: 120,
            height: 90,
            material: '3-ply-kraft',
            boxType: 'mailer',
            print: 'one-color',
            quantity: 500,
          },
          apparel: {
            width: 300,
            depth: 220,
            height: 110,
            material: '5-ply-kraft',
            boxType: 'mailer',
            print: 'two-color',
            quantity: 1000,
          },
          fmcg: {
            width: 360,
            depth: 260,
            height: 220,
            material: '5-ply-kraft',
            boxType: 'rsc',
            print: 'one-color',
            quantity: 1500,
          },
          heavy: {
            width: 420,
            depth: 320,
            height: 300,
            material: '7-ply-heavy',
            boxType: 'rsc',
            print: 'plain',
            quantity: 500,
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
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;

        viewer.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xfff2df, 0.46);
        scene.add(ambientLight);

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x3f2b1d, 0.55);
        scene.add(hemisphereLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.18);
        keyLight.position.set(280, 460, 320);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far = 900;
        keyLight.shadow.camera.left = -360;
        keyLight.shadow.camera.right = 360;
        keyLight.shadow.camera.top = 360;
        keyLight.shadow.camera.bottom = -360;
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0xffb86b, 0.58);
        rimLight.position.set(-260, 160, -240);
        scene.add(rimLight);

        const fillLight = new THREE.PointLight(0xffb86b, 0.7, 900);
        fillLight.position.set(-260, 180, 280);
        scene.add(fillLight);

        const floorGeometry = new THREE.PlaneGeometry(900, 900);
        const floorMaterial = new THREE.ShadowMaterial({
          opacity: 0.22,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -75;
        floor.receiveShadow = true;
        scene.add(floor);

        const boxGroup = new THREE.Group();
        boxGroup.rotation.set(-0.08, -0.45, 0);
        scene.add(boxGroup);

        const boardTexture = createCardboardTexture();
        boardTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const boardMaterial = new THREE.MeshStandardMaterial({
          color: 0xc98338,
          map: boardTexture,
          bumpMap: boardTexture,
          bumpScale: 0.75,
          roughness: 0.92,
          metalness: 0.01,
        });

        const innerBoardMaterial = boardMaterial.clone();
        innerBoardMaterial.roughness = 0.96;

        const edgeMaterial = new THREE.LineBasicMaterial({
          color: 0x6b3d19,
          transparent: true,
          opacity: 0.34,
        });

        const creaseMaterial = new THREE.MeshStandardMaterial({
          color: 0x8a4f1f,
          roughness: 0.98,
          metalness: 0,
        });

        const tapeMaterial = new THREE.MeshStandardMaterial({
          color: 0xf2c15d,
          transparent: true,
          opacity: 0.42,
          roughness: 0.62,
          metalness: 0,
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

        function createCardboardTexture() {
          const canvas = document.createElement('canvas');
          const size = 256;
          const context2d = canvas.getContext('2d');

          canvas.width = size;
          canvas.height = size;
          context2d.fillStyle = '#f2c05b';
          context2d.fillRect(0, 0, size, size);

          for (let y = 0; y < size; y += 5) {
            context2d.fillStyle = y % 10 === 0 ? 'rgba(125, 72, 25, 0.13)' : 'rgba(255, 255, 255, 0.09)';
            context2d.fillRect(0, y, size, 1);
          }

          for (let i = 0; i < 520; i++) {
            const alpha = 0.04 + Math.random() * 0.08;
            const shade = Math.random() > 0.5 ? 255 : 92;

            context2d.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${alpha})`;
            context2d.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
          }

          const texture = new THREE.CanvasTexture(canvas);
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(2.2, 1.45);

          return texture;
        }

        function addPanel(name, sizeX, sizeY, sizeZ, posX, posY, posZ, material = boardMaterial) {
          const panelGroup = new THREE.Group();
          const geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
          const panel = new THREE.Mesh(geometry, material);

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

        function addFlap(name, sizeX, sizeZ, hingeX, hingeY, hingeZ, openRotation, axis, layerOffset = 0, material = boardMaterial) {
          const flapGroup = new THREE.Group();
          const geometry = new THREE.BoxGeometry(sizeX, 5, sizeZ);
          const flap = new THREE.Mesh(geometry, material);
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

        function addDetailStrip(name, sizeX, sizeY, sizeZ, posX, posY, posZ, material = creaseMaterial) {
          const geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
          const strip = new THREE.Mesh(geometry, material);

          strip.name = name;
          strip.position.set(posX, posY, posZ);
          strip.castShadow = true;
          strip.receiveShadow = true;
          boxGroup.add(strip);

          return strip;
        }

        function addBoxDetails(w, d, h, t, baseY, topY, openProgress) {
          const lip = Math.max(2.5, t * 0.58);
          const cornerDepth = Math.max(3, t * 0.72);

          addDetailStrip('front-top-lip', w + t, lip, t * 0.62, 0, topY + 2.8, d / 2 + 1.7);
          addDetailStrip('back-top-lip', w + t, lip, t * 0.62, 0, topY + 2.8, -d / 2 - 1.7);
          addDetailStrip('left-top-lip', t * 0.62, lip, d + t, -w / 2 - 1.7, topY + 2.8, 0);
          addDetailStrip('right-top-lip', t * 0.62, lip, d + t, w / 2 + 1.7, topY + 2.8, 0);

          addDetailStrip('front-right-corner', cornerDepth, h + 5, cornerDepth, w / 2 + 1.4, baseY + h / 2, d / 2 + 1.4);
          addDetailStrip('front-left-corner', cornerDepth, h + 5, cornerDepth, -w / 2 - 1.4, baseY + h / 2, d / 2 + 1.4);
          addDetailStrip('back-right-corner', cornerDepth, h + 5, cornerDepth, w / 2 + 1.4, baseY + h / 2, -d / 2 - 1.4);

          if (openProgress <= 0.16) {
            const tapeY = topY + 7.2;

            addDetailStrip('top-center-tape', Math.max(8, w * 0.05), 1.4, d * 0.96, 0, tapeY, 0, tapeMaterial);
            addDetailStrip('top-front-score', w * 0.96, 1.2, 2.1, 0, tapeY + 0.6, d * 0.24, creaseMaterial);
            addDetailStrip('top-back-score', w * 0.96, 1.2, 2.1, 0, tapeY + 0.6, -d * 0.24, creaseMaterial);
          }
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
          addPanel('back', w, h, t, 0, midY, -d / 2, innerBoardMaterial);
          addPanel('left', t, h, d, -w / 2, midY, 0, innerBoardMaterial);
          addPanel('right', t, h, d, w / 2, midY, 0);
          addPanel('bottom', w, t, d, 0, baseY, 0, innerBoardMaterial);

          const selectedBoxType = boxTypes[boxType] || boxTypes.rsc;
          const endFlapLength = d * selectedBoxType.endFlapRatio;
          const sideFlapLength = w * selectedBoxType.sideFlapRatio;
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
          addBoxDetails(w, d, h, t, baseY, topY, openProgress);

          // Center model.
          boxGroup.position.y = 12;
        }

        function updateLabels() {
          const selectedMaterial = materials[boxMaterial] || materials['5-ply-kraft'];
          const selectedBoxType = boxTypes[boxType] || boxTypes.rsc;
          const selectedPrint = printOptions[printOption] || printOptions.plain;

          if (widthValue) {
            widthValue.textContent = formatDimension(boxWidth);
          }
          if (depthValue) {
            depthValue.textContent = formatDimension(boxDepth);
          }
          if (heightValue) {
            heightValue.textContent = formatDimension(boxHeight);
          }
          if (openValue) {
            openValue.textContent = `${boxOpen}%`;
          }
          if (unitValue) {
            unitValue.textContent = getSelectedUnit().label;
          }
          if (materialValue) {
            materialValue.textContent = selectedMaterial.shortLabel;
          }
          if (typeValue) {
            typeValue.textContent = selectedBoxType.shortLabel;
          }
          if (printValue) {
            printValue.textContent = selectedPrint.shortLabel;
          }
          if (quantityValue) {
            quantityValue.textContent = boxQuantity.toLocaleString();
          }
          if (strengthValue) {
            strengthValue.textContent = getStrengthRating(selectedMaterial, selectedBoxType);
          }
          boardMaterial.color.setHex(selectedMaterial.color);
          innerBoardMaterial.color.setHex(shiftHexColor(selectedMaterial.color, 28));
          creaseMaterial.color.setHex(shiftHexColor(selectedMaterial.color, -52));
          edgeMaterial.color.setHex(shiftHexColor(selectedMaterial.color, -74));
          updateCapacity(selectedMaterial, selectedBoxType);
          updateEstimate(selectedMaterial, selectedBoxType, selectedPrint);
          updateQuoteLink(selectedMaterial, selectedBoxType, selectedPrint);
        }

        function getSelectedUnit() {
          return units[boxUnit] || units.mm;
        }

        function shiftHexColor(hexColor, amount) {
          const red = clamp(((hexColor >> 16) & 255) + amount, 0, 255);
          const green = clamp(((hexColor >> 8) & 255) + amount, 0, 255);
          const blue = clamp((hexColor & 255) + amount, 0, 255);

          return (red << 16) + (green << 8) + blue;
        }

        function formatNumber(value, precision = 0) {
          const fixedValue = Number(value.toFixed(precision));

          return fixedValue.toLocaleString(undefined, {
            maximumFractionDigits: precision,
            minimumFractionDigits: precision,
          });
        }

        function formatDimension(valueInMm) {
          const unit = getSelectedUnit();

          return `${formatNumber(unit.fromMm(valueInMm), unit.precision)} ${unit.label}`;
        }

        function getStrengthRating(selectedMaterial, selectedBoxType) {
          const volume = boxWidth * boxDepth * boxHeight;
          const volumePenalty = volume > 25000000 ? 0.8 : volume > 12000000 ? 0.45 : 0;
          const score = selectedMaterial.strength + selectedBoxType.strength - volumePenalty;

          if (score >= 3.4) {
            return 'Heavy duty';
          }
          if (score >= 2.25) {
            return 'Medium duty';
          }

          return 'Light duty';
        }

        function updateCapacity(selectedMaterial, selectedBoxType) {
          const volumeLiters = (boxWidth * boxDepth * boxHeight) / 1000000;
          const volumePrecision = volumeLiters < 10 ? 1 : 0;
          const payloadScore = selectedMaterial.strength * selectedBoxType.strength;
          const payloadHigh = Math.max(2, Math.round(payloadScore * Math.sqrt(volumeLiters) * 1.6));
          const payloadLow = Math.max(1, Math.round(payloadHigh * 0.55));

          if (volumeValue) {
            volumeValue.textContent = `${formatNumber(volumeLiters, volumePrecision)} L`;
          }

          if (payloadValue) {
            payloadValue.textContent = `${payloadLow}-${payloadHigh} kg estimate`;
          }
        }

        function updateEstimate(selectedMaterial, selectedBoxType, selectedPrint) {
          if (!costValue) {
            return;
          }

          const surfaceArea = 2 * ((boxWidth * boxDepth) + (boxWidth * boxHeight) + (boxDepth * boxHeight));
          const squareMeters = surfaceArea / 1000000;
          const baseUnitCost = squareMeters * 18 * selectedMaterial.rate * selectedBoxType.rate * selectedPrint.rate;
          const setupCost = 450 + selectedPrint.setup;
          const quantityDiscount = boxQuantity >= 2000 ? 0.86 : boxQuantity >= 1000 ? 0.92 : 1;
          const estimatedTotal = (baseUnitCost * boxQuantity * quantityDiscount) + setupCost;
          const low = Math.max(0, Math.round(estimatedTotal * 0.9));
          const high = Math.round(estimatedTotal * 1.12);

          costValue.textContent = `₹${low.toLocaleString()} - ₹${high.toLocaleString()}`;
        }

        function updateQuoteLink(selectedMaterial, selectedBoxType, selectedPrint) {
          if (!quoteLink) {
            return;
          }

          const fallbackOrigin = 'https://ag-diagnosis.local';
          const url = createUrl(quoteBaseUrl || '/request-quote', fallbackOrigin);
          const unit = getSelectedUnit();

          url.searchParams.set('width', formatNumber(unit.fromMm(boxWidth), unit.precision));
          url.searchParams.set('depth', formatNumber(unit.fromMm(boxDepth), unit.precision));
          url.searchParams.set('height', formatNumber(unit.fromMm(boxHeight), unit.precision));
          url.searchParams.set('unit', unit.label);
          url.searchParams.set('material', selectedMaterial.label);
          url.searchParams.set('box_type', selectedBoxType.label);
          url.searchParams.set('print', selectedPrint.label);
          url.searchParams.set('quantity', boxQuantity);

          quoteLink.href = (url.origin === window.location.origin || url.origin === fallbackOrigin) ? `${url.pathname}${url.search}` : url.href;
        }

        function createUrl(value, fallbackOrigin) {
          const absoluteUrlPattern = /^[a-z][a-z\d+\-.]*:\/\//i;

          if (absoluteUrlPattern.test(value)) {
            return new URL(value);
          }

          const baseCandidates = [
            document.baseURI,
            window.location.href,
            window.location.origin,
          ].filter((candidate) => typeof candidate === 'string' && /^https?:\/\//i.test(candidate));

          for (const baseCandidate of baseCandidates) {
            try {
              return new URL(value, baseCandidate);
            }
            catch (error) {
              // Keep trying the next browser-provided base.
            }
          }

          return new URL(value.startsWith('/') ? value : `/${value}`, fallbackOrigin);
        }

        function onInputChange() {
          boxWidth = Number(widthInput.value);
          boxDepth = Number(depthInput.value);
          boxHeight = Number(heightInput.value);
          boxOpen = Number(openInput.value);
          boxUnit = unitInput.value;
          boxMaterial = materialInput.value;
          boxType = typeInput.value;
          printOption = printInput.value;
          boxQuantity = Math.max(100, Number(quantityInput.value || 100));

          updateLabels();
          buildBox();
        }

        function applyPreset(presetName) {
          const preset = presets[presetName];

          if (!preset) {
            return;
          }

          widthInput.value = preset.width;
          depthInput.value = preset.depth;
          heightInput.value = preset.height;
          materialInput.value = preset.material;
          typeInput.value = preset.boxType;
          printInput.value = preset.print;
          quantityInput.value = preset.quantity;

          onInputChange();
        }

        if (widthInput && depthInput && heightInput && openInput && unitInput && materialInput && typeInput && printInput && quantityInput) {
          widthInput.addEventListener('input', onInputChange);
          depthInput.addEventListener('input', onInputChange);
          heightInput.addEventListener('input', onInputChange);
          openInput.addEventListener('input', onInputChange);
          unitInput.addEventListener('change', onInputChange);
          materialInput.addEventListener('change', onInputChange);
          typeInput.addEventListener('change', onInputChange);
          printInput.addEventListener('change', onInputChange);
          quantityInput.addEventListener('input', onInputChange);

          presetButtons.forEach((button) => {
            button.addEventListener('click', () => applyPreset(button.dataset.boxPreset));
          });
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
