window.fullofstars = window.fullofstars || {};


(function() {


    fullofstars.updateViewport = function(window, renderer, camera) {
        var w = window.innerWidth;
        var h = window.innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
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
            var color = new THREE.Color(1, 0.7 + 0.3 * massFactor, 0.7 + 0.3 * massFactor);
            if(bodies[p].mass > 0.9999*fullofstars.TYPICAL_STAR_MASS * 100) { color = new THREE.Color(0,0,0); }
            var hsl = color.getHSL();
            color.setHSL(hsl.h, hsl.s*saturationFactor, hsl.l);
            colors[p] = color;
        }
        particles.colors = colors;
        return particles;
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
            35,         // Field of view
            W / H,  // Aspect ratio
            .0001 * fullofstars.MILKY_WAY_DIAMETER * fullofstars.UNIVERSE_SCALE,         // Near
            10 * fullofstars.MILKY_WAY_DIAMETER * fullofstars.UNIVERSE_SCALE       // Far
        );

        fullofstars.updateViewport(window, renderer, camera);
        window.addEventListener('resize', function() {fullofstars.updateViewport(window, renderer, camera)});

        var materials = fullofstars.createAllMaterials();

        var BODYCOUNT = 3000;
        var FAR_UPDATE_PERIOD = 10.0; // How long between updates of far interactions
        var FAR_BODYCOUNT_PER_60FPS_FRAME = Math.max(1, BODYCOUNT / (60*FAR_UPDATE_PERIOD));
        console.log("FAR_BODYCOUNT_PER_60FPS_FRAME", FAR_BODYCOUNT_PER_60FPS_FRAME);

        var bodies = fullofstars.createGravitySystem(BODYCOUNT);


        var mesh = new THREE.PointCloud( createCloudGeometryFromBodies(bodies, 1.0), materials.bright );
        var meshDust = new THREE.PointCloud( createCloudGeometryFromBodies(bodies, 0.9), materials.dust );
        var meshDebris = new THREE.PointCloud( createCloudGeometryFromBodies(bodies, 0.7), materials.debrisLarge )
        scene.add( mesh );
        scene.add( meshDust );
        scene.add( meshDebris );



        var TIME_SCALE = Math.pow(10, 9);
        var timeScale = TIME_SCALE;
        $("body").on("keypress", function(e) {
            if(e.which == 32) { timeScale = TIME_SCALE - timeScale; }
        });

        function render() {
            renderer.render( scene, camera );
        }

        var lastT = 0.0;
        var accumulatedFarDt = 0.0;
        var accumulatedRealDtTotal = 0.0;
        var gravityApplicator = fullofstars.createTwoTierSmartGravityApplicator(bodies);
        gravityApplicator.updateForces(bodies.length);
        function update(t) {
            var dt = (t - lastT) * 0.001 * timeScale;
            dt = Math.min(1 / 60.0, dt); // Clamp
            accumulatedRealDtTotal += dt;

            var positionScale = 2 * fullofstars.MILKY_WAY_DIAMETER * fullofstars.UNIVERSE_SCALE;
            var cameraRotationSpeed = 0.3;
            camera.position.set(Math.cos(accumulatedRealDtTotal*cameraRotationSpeed) * positionScale, positionScale * 0.5 * Math.sin(accumulatedRealDtTotal * 0.2), Math.sin(accumulatedRealDtTotal*cameraRotationSpeed) * positionScale);
            //camera.position.set(positionScale, 0, positionScale);

            var cameraLookatRotationSpeed = 0.8;
            var cameraLookAtScale = 0.1 * positionScale;
            camera.lookAt(new THREE.Vector3(Math.cos(accumulatedRealDtTotal*cameraLookatRotationSpeed) * cameraLookAtScale, 0, Math.sin(accumulatedRealDtTotal*cameraLookatRotationSpeed) * cameraLookAtScale));


            dt *= TIME_SCALE;
            accumulatedFarDt += dt;

            var useVerletUpdate = true;
            if(useVerletUpdate) {
                // This step updates positions
                for(var i=0, len=bodies.length; i<len; i++) {
                    bodies[i].velocityVerletUpdate(dt, true);
                    mesh.geometry.vertices[i].copy(bodies[i].position);
                }
                // This step updates velocities, so we can reuse forces for next position update (they will be the same because positios did not change)
                if(accumulatedFarDt >= TIME_SCALE / 60.0) {
                    gravityApplicator.updateForces(FAR_BODYCOUNT_PER_60FPS_FRAME);
                    accumulatedFarDt -= TIME_SCALE/60;
                }
                for(var i=0, len=bodies.length; i<len; i++) {
                    var body = bodies[i];
                    body.velocityVerletUpdate(dt, false);
                    body.force.copy(body.prevForce);
                }
            }
            else {
                fullofstars.applyBruteForceNewtonianGravity(bodies, dt);
                for(var i=0, len=bodies.length; i<len; i++) {
                    bodies[i].updateAndResetForce(dt);
                    mesh.geometry.vertices[i].copy(bodies[i].position);
                }
            }
            mesh.geometry.verticesNeedUpdate = true;
            meshDust.geometry.verticesNeedUpdate = true;
            meshDebris.geometry.verticesNeedUpdate = true;

            //mesh.rotation.x += dt*0.003;
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
