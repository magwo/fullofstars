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
var MAX_FORCE = 10000000000000000;
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
        if(velocityIsh.lengthSq() > fullofstars.LIGHT_SPEED_SCALED_SQRD) {
            velocityIsh.setLength(fullofstars.LIGHT_SPEED_SCALED*0.999);
        }
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

        // Dampen velocity (retarded version of energy emission?)
        //this.velocity.multiplyScalar(0.999);

        // Limit velocity to light speed (does this even make sense?)
        if(this.velocity.lengthSq() > fullofstars.LIGHT_SPEED_SCALED_SQRD) {
            this.velocity.setLength(fullofstars.LIGHT_SPEED_SCALED*0.999);
        }
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

                bodyToOther.multiplyScalar(fullofstars.UNIVERSE_SCALE_RECIPROCAL);

                var sqrDist = bodyToOther.lengthSq();
                var force = fullofstars.GRAVITATIONAL_CONSTANT * ((bodyMass*otherBodyMass) / sqrDist);

                // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
                var forceOnBody = bodyToOther.setLength(force);
                body.force.add(forceOnBody);
                otherBody.force.sub(forceOnBody);
            }
        }
    }
}


fullofstars.createTwoTierSmartGravityApplicator = function(celestials) {
    var applicator = {};

    var closeInteractions = _.map(celestials, function() { return []; });
    var closeInteractionCount = 0;

    var farForces = _.map(celestials, function() { return new THREE.Vector3(0, 0, 0); });

    var currentLongI = 0;

    var FAR_THRESHOLD_SQR = Math.pow(100 * fullofstars.UNIVERSE_SCALE_RECIPROCAL, 2); // TODO: Make this more related to mass and distance combined

    // TODO: Inline this when mature solution
    // Returns: Whether this should be a close or far interaction
    var applyGravity = function(body1, body2) {
        var body1To2 = tempVec.subVectors(body2.position, body1.position);
        body1To2.multiplyScalar(fullofstars.UNIVERSE_SCALE_RECIPROCAL);
        var sqrDist = body1To2.lengthSq();
        var force = fullofstars.GRAVITATIONAL_CONSTANT * ((body1.mass*body2.mass) / sqrDist);
        // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
        var forceOnBody = body1To2.setLength(force);
        body1.force.add(forceOnBody);
        body2.force.sub(forceOnBody);

        return sqrDist < FAR_THRESHOLD_SQR || body1.mass+body2.mass > fullofstars.MAX_MASS / 1.4;
    };

    var addGravityToVector = function(body1, body2, vector) {
        var body1To2 = tempVec.subVectors(body2.position, body1.position);
        body1To2.multiplyScalar(fullofstars.UNIVERSE_SCALE_RECIPROCAL);
        var sqrDist = body1To2.lengthSq();
        var force = fullofstars.GRAVITATIONAL_CONSTANT * ((body1.mass*body2.mass) / sqrDist);
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
            for(var innerKey in closeInteractions[i]) {
                var isClose = applyGravity(celestials[i], celestials[innerKey]);
                if(!isClose) {
                    // Remove this interaction
                    delete closeInteractions[i][innerKey];
                    closeInteractionCount--;
                }
            }
        }
    };

    applicator.handleFarInteractions = function(bodyCountToUpdateFarForcesFor) {
        var celestCount = celestials.length;
        for(var n=0; n<bodyCountToUpdateFarForcesFor; n++) {
            currentLongI++;
            if(currentLongI >= celestCount) {
                currentLongI = 0;
            }

            // Make a sum of all the other bodies attraction forces and save them
            var farForce = farForces[currentLongI];
            farForce.set(0,0,0);
            var body1 = celestials[currentLongI];
            for(var j=0; j<celestCount; j++) {
                if(j != currentLongI) {
                    var sortedI = currentLongI < j ? currentLongI : j;
                    var sortedJ = currentLongI < j ? j : currentLongI;
                    if(closeInteractions[sortedI][sortedJ] !== true) {
                        if(addGravityToVector(body1, celestials[j], farForce)) {
                            // Should handle this as a close interaction
                            closeInteractions[sortedI][sortedJ] = true;
                            closeInteractionCount++;
                        }
                    }
                }
            }
            farForces[currentLongI] = farForce;
        }
    }

    applicator.applyFarForces = function() {
        for(var i=0, len=celestials.length; i<len; i++) {
            celestials[i].force.add(farForces[i]);
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




fullofstars.createGravitySystem = function(particleCount) {
    var bodies = [];

    var typicalStarSpeed = 600 * 1000 * fullofstars.UNIVERSE_SCALE;
    var side = Math.sqrt(particleCount*1000);

    for (var p = 0; p < particleCount; p++) {
        var pX = Math.random() * side - side*0.5;
        var pY = Math.random() * side - side*0.5;
        var pZ = 0;//Math.random() * 100 - 50;


        if(p === 0) {
            var pos = new THREE.Vector3(-300,0,0);
            var mass = fullofstars.TYPICAL_STAR_MASS * 1000;
            var xVel = 0;
            var yVel = typicalStarSpeed;
        }
        else if(p === 1) {
            var pos = new THREE.Vector3(300,0,0);
            var mass = fullofstars.TYPICAL_STAR_MASS * 1000;
            var xVel = 0;
            var yVel = -typicalStarSpeed;
        }
        else {
            var pos = new THREE.Vector3(pX, pY, pZ);
            var mass = fullofstars.TYPICAL_STAR_MASS * 2 * Math.random() * Math.random();
            var xVel = Math.sign(pos.y) * typicalStarSpeed * 1.2;
            var yVel = Math.sign(pos.x) * typicalStarSpeed * 1.2;
        }
        var body = new PointMassBody(mass, pos, new THREE.Vector3(xVel, yVel, 0));
        bodies.push(body);
    }
    return bodies;
};


})();
