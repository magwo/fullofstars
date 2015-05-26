window.fullofstars = window.fullofstars || {};

(function() {

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

PointMassBody.prototype.velocityVerletUpdate = function(dt, isPositionStep) {
    var force = this.force;
    if(isPositionStep) {
        var accelerationFactor = this.invMass * dt * 0.5;
        var velocityIsh = tempVec;
        velocityIsh.copy(this.velocity);
        tempVec2.set(force.x*accelerationFactor, force.y*accelerationFactor, force.z*accelerationFactor);
        velocityIsh.add(tempVec2);
        velocityIsh.multiplyScalar(dt); // Temp velocity(ish) is now timestep multiplied
        //position += timestep * (velocity + timestep * acceleration / 2);
        this.position.add(velocityIsh);
    } else {
        // Velocity step
        // velocity += timestep * (acceleration + newAcceleration) / 2;
        var accelerationFactor = this.invMass * dt * 0.5;
        var accelerationIsh = tempVec;
        var prevForce = this.prevForce;
        accelerationIsh.set((force.x+prevForce.x)*accelerationFactor, (force.y+prevForce.y)*accelerationFactor, (force.z+prevForce.z)*accelerationFactor);
        this.velocity.add(accelerationIsh);
    }
    this.prevForce.copy(force);
    this.force.set(0,0,0);
};


fullofstars.applyBruteForceNewtonianGravity = function(celestials) {
    // Apply gravitational forces to all bodies, from all celestial bodies
    var tempVec = new THREE.Vector3();
    for(var i=0, celestLen=celestials.length; i<celestLen; i++) {
        var body = celestials[i];
        var bodyMass = body.mass;
        var bodyPos = body.position;
        for(var j=i+1, len=celestials.length; j<len; j++) {
            if(i !== j) {
            	var otherBody = celestials[j];
            	//console.log("applying gravity", body, otherBody);
                var otherBodyPos = otherBody.position;
                var otherBodyMass = otherBody.mass;
                var bodyToOther = tempVec.subVectors(otherBodyPos, bodyPos);
                
                var sqrDist = bodyToOther.lengthSq();
                var force = GRAVITATIONAL_CONSTANT * ((bodyMass*otherBodyMass) / sqrDist);
                // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
                var forceOnBody = bodyToOther.setLength(force);
                body.force.add(forceOnBody);
                otherBody.force.sub(forceOnBody);
            }
        }
    }
}


// Smart gravity application system... hmm
// Interaction combination table
//
// 1. Find close interactions
// 2. Handle close interactions
// 3. Add close interactions to interaction table, with sorted ids [50: [51, 60, 112], ]
// 2. Iterate K times for non-close interactions, where K is related to update interval on non-close interactions

fullofstars.createTwoTierSmartGravityApplicator = function(celestials) {
    var applicator = {};

    var closeInteractions = [];
    var closeInteractionCount = 0;

    var farForces = _.map(celestials, function() { return new THREE.Vector3(0, 0, 0); });

    var currentLongI = 0;

    var FAR_THRESHOLD_SQR = Math.pow(20, 2); // TODO: Make this more related to mass and distance combined

    // TODO: Inline this when mature solution
    // Returns: Whether this should be a close or far interaction
    var applyGravity = function(body1, body2) {
        var body1To2 = tempVec.subVectors(body2.position, body1.position);
        var sqrDist = body1To2.lengthSq();
        var force = GRAVITATIONAL_CONSTANT * ((body1.mass*body2.mass) / sqrDist);
        // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
        var forceOnBody = bodyToOther.setLength(force);
        body1.force.add(forceOnBody);
        body2.force.sub(forceOnBody);

        return sqrDist < FAR_THRESHOLD_SQR;
    };

    var addGravityToVector = function(body1, body2, vector) {
        var body1To2 = tempVec.subVectors(body2.position, body1.position);
        var sqrDist = body1To2.lengthSq();
        var force = GRAVITATIONAL_CONSTANT * ((body1.mass*body2.mass) / sqrDist);
        // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
        var forceOnBody = bodyToOther.setLength(force);
        if(sqrDist < FAR_THRESHOLD_SQR) {
            return true; // This should be handled as a close interaction
        }
        vector.add(forceOnBody);
        return false;
    };

    applicator.handleCloseInteractions = function() {
        for(var i=0, outerLen=closeInteractions.length; i<outerLen; i++) {
            for(var innerKey in closeInteractions[i]) {
                var isClose = applyGravity(celestials[i], celestials[closeInteractions[i][j]], dt);
                if(!isClose) {
                    // Remove this interaction
                    delete closeInteractions[i][innerKey];
                    closeInteractionCount--;
                }
            }
        }
    };

    applicator.handleFarInteractions = function(bodyCount) {
        var celestCount = celestials.length;
        for(var n=0; n<bodyCount; n++) {
            currentLongI++;
            if(currentLongI >= celestCount) {
                currentLongI = 0;
            }

            // Make a sum of all the other bodies attraction forces and save them
            var farForce = farForces[currentLongI];
            farFoce.set(0,0,0);
            var body1 = celestials[currentLongI];
            for(var j=0; j<celestCount; j++) {
                if(j != currentLongI) {
                    if(!addGravityToVector(body1, celestials[j], farForce)) {
                        // Should handle this as a close interaction
                        closeInteractions[currentLongI][j] = true;
                    }
                }
            }
        }
    }

    applicator.applyFarForces = function() {
        for(var i=0, len=celestials.length; i<len; i++) {
            celestials[i].force.add(farForces[i]);
        }
    }
                

    var FAR_UPDATE_PERIOD = 2.0; // How long between updates of far interactions

    applicator.apply = function() {
        applicator.handleFarInteractions(1); // TODO: Consider the count, should relate to number of bodies and desired precision
        applicator.applyFarForces();
        applicator.handleCloseInteractions();
    };

    return applicator;
}


fullofstars.MAX_MASS = 100000000000000;

fullofstars.createGravitySystem = function(particleCount) {
    var bodies = [];

    for (var p = 0; p < particleCount; p++) {
        var pX = Math.random() * 500 - 250;
        var pY = Math.random() * 500 - 250;
        var pZ = Math.random() * 100 - 50;
        

        if(p === 0) {
            var pos = new THREE.Vector3(0,0,0);
            var mass = fullofstars.MAX_MASS * 1000;
            var xVel = 0;
            var yVel = 0;
        }
        else {
            var pos = new THREE.Vector3(pX, pY, pZ);
            var mass = fullofstars.MAX_MASS * Math.random() * Math.random();
            var xVel = 120*Math.sign(pos.y);
            var yVel = -120*Math.sign(pos.x);
        }
        var body = new PointMassBody(mass, pos, new THREE.Vector3(xVel, yVel, 0));
        bodies.push(body);
    }
    return bodies;
};


})();