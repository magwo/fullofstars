window.fullofstars = window.fullofstars || {};


var MAX_MASS = 100000000000000;

fullofstars.createGravitySystem = function(particleCount) {
    var bodies = [];

    for (var p = 0; p < particleCount; p++) {
        var pX = Math.random() * 500 - 250;
        var pY = Math.random() * 500 - 250;
        var pZ = Math.random() * 100 - 50;
        var pos = new THREE.Vector3(pX, pY, pZ);

        var mass = MAX_MASS * Math.random() * Math.random();
        var xVel = 60*Math.tan(Math.PI*pos.x/250);
        var yVel = -60*Math.tan(Math.PI*pos.y/250);
        var body = new PointMassBody(mass, pos, new THREE.Vector3(xVel, yVel, 0));
        bodies.push(body);
    }
    return bodies;
};

fullofstars.updateViewport = function(window, renderer, camera) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
};


(function() {

    


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
            var massFactor = bodies[p].mass / MAX_MASS;
            var color = new THREE.Color(1, 0.3 + 0.6 * massFactor, 0.3 + 0.6 * massFactor);
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
        document.body.appendChild(renderer.domElement);
        var scene = new THREE.Scene();

        var camera = new THREE.PerspectiveCamera(
            35,         // Field of view
            W / H,  // Aspect ratio
            .1,         // Near
            10000       // Far
        );
        camera.position.set(-15, 10, 1000);
        camera.lookAt(scene.position);

        fullofstars.updateViewport(window, renderer, camera);
        window.addEventListener('resize', function() {fullofstars.updateViewport(window, renderer, camera)});

        var materials = fullofstars.createAllMaterials();

        var bodies = fullofstars.createGravitySystem(1000);


        var mesh = new THREE.PointCloud( createCloudGeometryFromBodies(bodies, 1.0), materials.bright );
        var meshDust = new THREE.PointCloud( createCloudGeometryFromBodies(bodies, 0.6), materials.dust );
        var meshDebris = new THREE.PointCloud( createCloudGeometryFromBodies(bodies, 0.3), materials.debrisLarge )
        scene.add( mesh );
        scene.add( meshDust );
        scene.add( meshDebris );

        function render() {
            renderer.render( scene, camera );
        }

        var lastT = 0.0;
        function update(t) {
            var dt = (t - lastT) * 0.001;

            applyBruteForceNewtonianGravity(bodies, dt);
            for(var i=0, len=bodies.length; i<len; i++) {
                bodies[i].updateAndResetForce(dt);
                mesh.geometry.vertices[i].copy(bodies[i].position);
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