window.fullofstars = window.fullofstars || {};


(function() {


    fullofstars.updateViewport = function(window, renderer, camera, skybox) {
        var w = window.innerWidth;
        var h = window.innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        skybox.camera.aspect = w / h;
        skybox.camera.updateProjectionMatrix();
    };



    function createCloudGeometryFromBodies(bodies, saturationFactor) {
        // create the particle variables
        var particleCount = bodies.length;
        var particles = new THREE.Geometry();
        var colors = [];

        // now create the individual particles
        for (var p = 0; p < particleCount; p++) {
            particle = bodies[p].position;
            // add it to the geometry
            particles.vertices.push(particle);
            var massFactor = bodies[p].mass / fullofstars.TYPICAL_STAR_MASS;
            var color = new THREE.Color(0.5+0.3 * massFactor, 0.6+0.3 * massFactor, 0.7 + 0.3 * massFactor);
            if(bodies[p].mass > 0.9999*fullofstars.TYPICAL_STAR_MASS * 100) { color = new THREE.Color(0,0,0); }
            var hsl = color.getHSL();
            color.setHSL(hsl.h, hsl.s*saturationFactor, hsl.l);
            colors[p] = color;
        }
        particles.colors = colors;
        return particles;
    }


    function createSkyboxStuff() {
        // Make a skybox
        var urls = [
            'images/BlueNebular_left.jpg',
            'images/BlueNebular_right.jpg',

            'images/BlueNebular_top.jpg',
            'images/BlueNebular_bottom.jpg',

            'images/BlueNebular_front.jpg',
            'images/BlueNebular_back.jpg'
        ];

        var skyboxScene = new THREE.Scene();
        var skyboxCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 100, 60000 );

        var cubemap = THREE.ImageUtils.loadTextureCube(urls); // load textures
        cubemap.format = THREE.RGBFormat;

        var skyboxShader = THREE.ShaderLib['cube']; // init cube shader from built-in lib
        skyboxShader.uniforms['tCube'].value = cubemap; // apply textures to shader

        // create shader material
        var skyBoxMaterial = new THREE.ShaderMaterial( {
          fragmentShader: skyboxShader.fragmentShader,
          vertexShader: skyboxShader.vertexShader,
          uniforms: skyboxShader.uniforms,
          depthWrite: false,
          side: THREE.BackSide
        });

        // create skybox mesh
        var skybox = new THREE.Mesh(
          new THREE.BoxGeometry(50000,50000,50000),
          skyBoxMaterial
        );
        skyboxScene.add(skybox);

        return { scene: skyboxScene, camera: skyboxCamera };
    }



    $(function() {
        var W = 1200;
        var H = 800;

        var renderer = new THREE.WebGLRenderer();
        renderer.setSize( W, H );
        renderer.setClearColor(0x000000);
        document.body.appendChild(renderer.domElement);
        var scene = new THREE.Scene();

        var camera = new THREE.PerspectiveCamera(
            45,         // Field of view
            W / H,  // Aspect ratio
            .0001 * fullofstars.MILKY_WAY_DIAMETER * fullofstars.UNIVERSE_SCALE,         // Near
            10 * fullofstars.MILKY_WAY_DIAMETER * fullofstars.UNIVERSE_SCALE       // Far
        );

        var skybox = createSkyboxStuff();
        fullofstars.updateViewport(window, renderer, camera, skybox);
        window.addEventListener('resize', function() {fullofstars.updateViewport(window, renderer, camera, skybox)});


        var materials = fullofstars.createAllMaterials();

        var BODYCOUNT = 500;
        var BODYCOUNT_VFX = 20000;
        var BODYCOUNT_GAS = 500;
        var FAR_UPDATE_PERIOD = 2.0; // How long between updates of far interactions
        var FAR_BODYCOUNT_PER_60FPS_FRAME = Math.max(1, BODYCOUNT / (60*FAR_UPDATE_PERIOD));
        console.log("FAR_BODYCOUNT_PER_60FPS_FRAME", FAR_BODYCOUNT_PER_60FPS_FRAME);

        var bodies = fullofstars.createGravitySystem(BODYCOUNT, true);
        var bodiesVfx = fullofstars.createGravitySystem(BODYCOUNT_VFX, false);
        var bodiesGas = fullofstars.createGravitySystem(BODYCOUNT_GAS, false);


        var mesh = new THREE.PointCloud( createCloudGeometryFromBodies(bodies, 1.0), materials.bright );
        mesh.frustumCulled = false;
        var meshVfx = new THREE.PointCloud( createCloudGeometryFromBodies(bodiesVfx, 1.0), materials.brightSmall );
        meshVfx.frustumCulled = false;
        var meshGas = new THREE.PointCloud( createCloudGeometryFromBodies(bodiesGas, 1.0), materials.gasCloud );
        meshGas.frustumCulled = false;

        scene.add(meshGas);
        scene.add(mesh);
        scene.add(meshVfx);

        var TIME_SCALE = Math.pow(10, 9);
        var timeScale = TIME_SCALE;
        $("body").on("keypress", function(e) {
            if(e.which == 32) { timeScale = TIME_SCALE - timeScale; }
        });

        function render() {
            renderer.autoclear = false;
            renderer.autoClearColor = false;
            skybox.camera.quaternion.copy(camera.quaternion);
            renderer.render(skybox.scene, skybox.camera);
            renderer.render(scene, camera);
        }

        var lastT = 0.0;
        var accumulatedFarDt = 0.0;
        var accumulatedRealDtTotal = 0.0;
        var gravityApplicator = fullofstars.createTwoTierSmartGravityApplicator(bodies, bodies);
        var gravityApplicatorVfx = fullofstars.createTwoTierSmartGravityApplicator(bodiesVfx, bodies);
        var gravityApplicatorGas = fullofstars.createTwoTierSmartGravityApplicator(bodiesGas, bodies);
        gravityApplicator.updateForces(bodies.length);
        gravityApplicatorVfx.updateForces(bodiesVfx.length);
        gravityApplicatorGas.updateForces(bodiesGas.length);

        function update(t) {
            var dt = (t - lastT) * 0.001 * timeScale;
            dt = Math.min(1 / 60.0, dt); // Clamp
            accumulatedRealDtTotal += dt;

            var positionScale = 1.5 * fullofstars.MILKY_WAY_DIAMETER * fullofstars.UNIVERSE_SCALE;
            var cameraRotationSpeed = 0.3;
            camera.position.copy(bodies[0].position);
            camera.position.add(new THREE.Vector3(Math.cos(accumulatedRealDtTotal*cameraRotationSpeed) * positionScale, positionScale * 0.5 * Math.sin(accumulatedRealDtTotal * 0.2), Math.sin(accumulatedRealDtTotal*cameraRotationSpeed) * positionScale));

            var cameraLookatRotationSpeed = 0.8;
            var cameraLookAtScale = 0.2 * positionScale;
            var cameraLookAtPos = new THREE.Vector3().copy(bodies[0].position);
            cameraLookAtPos.add(new THREE.Vector3(Math.cos(accumulatedRealDtTotal*cameraLookatRotationSpeed) * cameraLookAtScale, 0, Math.sin(accumulatedRealDtTotal*cameraLookatRotationSpeed) * cameraLookAtScale))
            camera.lookAt(cameraLookAtPos);


            dt *= TIME_SCALE;
            accumulatedFarDt += dt;

            // This step updates positions
            fullofstars.PointMassBody.velocityVerletUpdate(bodies, dt, true);
            fullofstars.PointMassBody.velocityVerletUpdate(bodiesVfx, dt, true);
            fullofstars.PointMassBody.velocityVerletUpdate(bodiesGas, dt, true);

            for(var i=0, len=bodies.length; i<len; i++) {
                mesh.geometry.vertices[i].copy(bodies[i].position);
            }
            
            for(var i=0, len=bodiesVfx.length; i<len; i++) {
                meshVfx.geometry.vertices[i].copy(bodiesVfx[i].position);
            }

            for(var i=0, len=bodiesGas.length; i<len; i++) {
                meshGas.geometry.vertices[i].copy(bodiesGas[i].position);
            }

            // This step updates velocities, so we can reuse forces for next position update (they will be the same because positios did not change)
            if(accumulatedFarDt >= TIME_SCALE / 60.0) {
                gravityApplicator.updateForces(FAR_BODYCOUNT_PER_60FPS_FRAME);
                gravityApplicatorVfx.updateForces(FAR_BODYCOUNT_PER_60FPS_FRAME*20);
                gravityApplicatorGas.updateForces(FAR_BODYCOUNT_PER_60FPS_FRAME);
                accumulatedFarDt -= TIME_SCALE/60;
            }

            fullofstars.PointMassBody.velocityVerletUpdate(bodies, dt, false);
            fullofstars.PointMassBody.velocityVerletUpdate(bodiesVfx, dt, false);
            fullofstars.PointMassBody.velocityVerletUpdate(bodiesGas, dt, false);

            mesh.geometry.verticesNeedUpdate = true;
            meshVfx.geometry.verticesNeedUpdate = true;
            meshGas.geometry.verticesNeedUpdate = true;
            lastT = t;
        };

        function handleAnimationFrame(dt) {
            update(dt);
            render();
            window.requestAnimationFrame(handleAnimationFrame);
        };
        window.requestAnimationFrame(handleAnimationFrame);

    });
})();
