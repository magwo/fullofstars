(function() {

window.fullofstars = window.fullofstars || {};

function PointMassBody(mass, position, velocity) {
    this.mass = mass;
    this.invMass = 1.0 / mass;
    this.position = position;
    this.velocity = velocity;
    this.force = new THREE.Vector3(0,0,0);
    this.prevForce = new THREE.Vector3(0,0,0);
}
PointMassBody.prototype = Object.create(Object.prototype);


var tempVec = new THREE.Vector3(0,0,0); // To avoid allocations during updates
var tempVec2 = new THREE.Vector3(0,0,0); // To avoid allocations during updates
PointMassBody.prototype.updateAndResetForce = function(dt) {
	var accelerationFactor = this.invMass * dt;
	var force = this.force;
	var velocity = this.velocity;
	tempVec.set(force.x*accelerationFactor, force.y*accelerationFactor, force.z*accelerationFactor);
	this.velocity.add(tempVec);
	tempVec.set(velocity.x*dt, velocity.y*dt, velocity.z*dt);
	this.position.add(tempVec);
    this.prevForce.copy(force);
	this.force.set(0,0,0);
};

PointMassBody.velocityVerletUpdate = function(dt, isPositionStep) {
    // TODO: Make this operate on array instead of individual bodies
    var force = this.force;
    if(isPositionStep) {
        var accelerationFactor = this.invMass * dt * 0.5;
        var velocityIsh = tempVec;
        velocityIsh.copy(this.velocity);
        tempVec2.set(force.x*accelerationFactor, force.y*accelerationFactor, force.z*accelerationFactor);
        velocityIsh.add(tempVec2);
        velocityIsh.multiplyScalar(dt); // Temp velocity(ish) is now timestep multiplied
        //VERLET: position += timestep * (velocity + timestep * acceleration / 2);
        this.position.add(velocityIsh);
    } else {
        // Velocity step
        //VERLET: velocity += timestep * (acceleration + newAcceleration) / 2;
        var accelerationFactor = this.invMass * dt * 0.5;
        var accelerationIsh = tempVec;
        var prevForce = this.prevForce;
        accelerationIsh.set((force.x+prevForce.x)*accelerationFactor, (force.y+prevForce.y)*accelerationFactor, (force.z+prevForce.z)*accelerationFactor);
        this.velocity.add(accelerationIsh);
    }
    this.prevForce.copy(force);
    this.force.set(0,0,0);
};


// TODO: How to support visual-only particles:
// 1. Make this support two groups of celestials - first one is the one affected by
//    the other group.
// 2. Normal case: both groups are the same.
// 3. Visuals-only case: first group is a visuals-only group of celestials
fullofstars.createTwoTierSmartGravityApplicator = function(attractedCelestials, attractingCelestials) {
    var applicator = {};
    var attractingIsAttracted = attractingCelestials === attractedCelestials;

    var closeInteractions = _.map(attractedCelestials, function() { return []; });
    var closeInteractionCount = 0;

    var farForces = _.map(attractedCelestials, function() { return new THREE.Vector3(0, 0, 0); });

    var currentFarAttractedIndex = 0;

    var FAR_THRESHOLD_SQR = Math.pow(100 * fullofstars.UNIVERSE_SCALE_RECIPROCAL, 2); // TODO: Make this more related to mass and distance combined

    // TODO: Inline this when mature solution
    // Returns: Whether this should be a close interaction
    var applyGravity = function(body1, body2) {

        var isBlackHoleInteraction = body1.mass+body2.mass > (fullofstars.TYPICAL_STAR_MASS * 100);

        var body1To2 = tempVec.subVectors(body2.position, body1.position);
        body1To2.multiplyScalar(fullofstars.UNIVERSE_SCALE_RECIPROCAL);
        var sqrDist = body1To2.lengthSq();

        var force = fullofstars.GRAVITATIONAL_CONSTANT * ((body1.mass*body2.mass) / (sqrDist + fullofstars.GRAVITY_EPSILON*fullofstars.GRAVITY_EPSILON));
        // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
        var forceOnBody = body1To2.setLength(force);

        var GAS_INTERACTION_DISTANCE_SQRD = Math.pow(100 * fullofstars.UNIVERSE_SCALE_RECIPROCAL, 2);

        if(!isBlackHoleInteraction && sqrDist < GAS_INTERACTION_DISTANCE_SQRD) {
            // TODO: Use gas constants instead
            var gasForce = fullofstars.GRAVITATIONAL_CONSTANT * ((body1.mass*body2.mass) / (sqrDist + fullofstars.GRAVITY_EPSILON*fullofstars.GRAVITY_EPSILON));
            tempVec2.copy(body1.velocity);
            var relativeVel = tempVec2.sub(body2.velocity);
            var gasForceOnBody = relativeVel.multiplyScalar(gasForce*Math.pow(10, 9));

            body1.force.sub(gasForceOnBody)
            if(attractingIsAttracted); {
                body2.force.add(gasForceOnBody);
            }
        }




        body1.force.add(forceOnBody);
        if(attractingIsAttracted); {
            body2.force.sub(forceOnBody);
        }

        return sqrDist < FAR_THRESHOLD_SQR || body1.mass+body2.mass > fullofstars.TYPICAL_STAR_MASS * 100;
    };

    // Returns: Whether this should be a close interaction
    var addGravityToVector = function(body1, body2, vector) {
        var body1To2 = tempVec.subVectors(body2.position, body1.position);
        body1To2.multiplyScalar(fullofstars.UNIVERSE_SCALE_RECIPROCAL);
        var sqrDist = body1To2.lengthSq();
        var force = fullofstars.GRAVITATIONAL_CONSTANT * ((body1.mass*body2.mass) / (sqrDist + fullofstars.GRAVITY_EPSILON*fullofstars.GRAVITY_EPSILON));
        // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
        var forceOnBody = body1To2.setLength(force);
        if(sqrDist < FAR_THRESHOLD_SQR || body1.mass+body2.mass > fullofstars.TYPICAL_STAR_MASS * 100) {
            return true; // This should be handled as a close interaction
        }
        vector.add(forceOnBody);
        return false;
    };

    applicator.handleCloseInteractions = function() {
        for(var i=0, outerLen=closeInteractions.length; i<outerLen; i++) {
            // TODO: Using for-in iteration and objects like this probably has terrible performance
            // Should probably change to simple arrays instead.
            for(var innerKey in closeInteractions[i]) {
                var isClose = applyGravity(attractedCelestials[i], attractingCelestials[innerKey]);
                if(!isClose) {
                    // Remove this interaction
                    delete closeInteractions[i][innerKey];
                    closeInteractionCount--;
                }
            }
        }
    };

    applicator.handleFarInteractions = function(bodyCountToUpdateFarForcesFor) {
        var attractedCount = attractedCelestials.length;
        for(var n=0; n<bodyCountToUpdateFarForcesFor; n++) {
            currentFarAttractedIndex++;
            if(currentFarAttractedIndex >= attractedCount) {
                currentFarAttractedIndex = 0;
            }

            // Make a sum of all the other bodies attraction forces and save them
            var farForce = farForces[currentFarAttractedIndex];
            farForce.set(0,0,0);
            var attractedBody = attractedCelestials[currentFarAttractedIndex];
            // TODO: Details with attracting/attracted storage here...
            for(var attractingIndex=0, len=attractingCelestials.length; attractingIndex<len; attractingIndex++) {
                if(attractingIndex !== currentFarAttractedIndex || !attractingIsAttracted) {
                    var isCloseInteraction = closeInteractions[currentFarAttractedIndex][attractingIndex] === true;
                    if(!isCloseInteraction && attractingIsAttracted) {
                        isCloseInteraction = closeInteractions[attractingIndex][currentFarAttractedIndex] === true;
                    }
                    if(!isCloseInteraction) {
                        if(addGravityToVector(attractedBody, attractingCelestials[attractingIndex], farForce)) {
                            // Should handle this as a close interaction
                            closeInteractions[currentFarAttractedIndex][attractingIndex] = true;
                            closeInteractionCount++;
                        }
                    }
                }
            }
            farForces[currentFarAttractedIndex] = farForce;
        }
    }

    applicator.applyFarForces = function() {
        for(var i=0, len=attractedCelestials.length; i<len; i++) {
            attractedCelestials[i].force.add(farForces[i]);
        }
    }


    applicator.updateForces = function(bodyCountToUpdateFarForcesFor) {
        //console.log("closeInteractionCount", closeInteractionCount);
        applicator.handleCloseInteractions();
        applicator.handleFarInteractions(bodyCountToUpdateFarForcesFor);
        applicator.applyFarForces();
    };
    return applicator;
}




fullofstars.createGravitySystem = function(particleCount, makeBlackHole) {
    var bodies = [];

    var typicalStarSpeed = 20000000 * 1000 * fullofstars.UNIVERSE_SCALE;
    console.log("typical star speed", typicalStarSpeed);
    var side = 2000.0;

    for (var p = 0; p < particleCount; p++) {
        var pX = Math.random() * side - side*0.5;
        var pY = Math.random() * side * 0.1 - side * 0.05;
        var pZ = Math.random() * side - side*0.5;


        if(makeBlackHole && p === 0) {
          console.log("Creating black hole");
            var pos = new THREE.Vector3(0,0,0);
            var mass = fullofstars.TYPICAL_STAR_MASS * 10000;
            var xVel = 0;
            var yVel = 0;
        }
        else {
            var pos = new THREE.Vector3(pX, pY, pZ);
            var mass = fullofstars.TYPICAL_STAR_MASS * 2 * Math.random() * Math.random();
            var xVel = Math.sign(pos.y) * typicalStarSpeed;
            var yVel = Math.sign(pos.x) * typicalStarSpeed;
            var zVel = Math.sign(pos.x) * typicalStarSpeed;
        }
        var body = new PointMassBody(mass, pos, new THREE.Vector3(xVel, yVel, zVel));
        bodies.push(body);
    }
    return bodies;
};


})();
