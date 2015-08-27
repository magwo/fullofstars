(function() {

window.fullofstars = window.fullofstars || {};

window.fullofstars.PointMassBody = PointMassBody;

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

PointMassBody.verletPositionStep = function(bodies, dt) {
    // Highly inlined for performance
    var velocityishX = 0.0, velocityishY = 0.0, velocityishZ = 0.0;
    for(var i=0, len=bodies.length; i<len; i++) {
        var body = bodies[i];
        var accelerationFactor = body.invMass * dt * 0.5;
        var position = body.position;
        var velocity = body.velocity;
        var force = body.force;
        var prevForce = body.prevForce;

        velocityishX = velocity.x;
        velocityishY = velocity.y;
        velocityishZ = velocity.z;

        velocityishX += force.x*accelerationFactor;
        velocityishY += force.y*accelerationFactor;
        velocityishZ += force.z*accelerationFactor;

        //VERLET: position += timestep * (velocity + timestep * acceleration / 2);
        position.x += velocityishX*dt;
        position.y += velocityishY*dt;
        position.z += velocityishZ*dt;

        prevForce.x = force.x;
        prevForce.y = force.y;
        prevForce.z = force.z;
    }
};

PointMassBody.verletAccelerationStep = function(bodies, dt) {
    // Highly inlined for performance
    for(var i=0, len=bodies.length; i<len; i++) {
        var body = bodies[i];
        var force = body.force;
        var velocity = body.velocity;
        var prevForce = body.prevForce;
        //VERLET: velocity += timestep * (acceleration + newAcceleration) / 2;
        var accelerationFactor = body.invMass * dt * 0.5;

        velocity.x += (force.x+prevForce.x)*accelerationFactor;
        velocity.y += (force.y+prevForce.y)*accelerationFactor;
        velocity.z += (force.z+prevForce.z)*accelerationFactor;

        prevForce.x = force.x;
        prevForce.y = force.y;
        prevForce.z = force.z;

        force.x = force.y = force.z = 0.0;
    }
};


PointMassBody.velocityVerletUpdate = function(bodies, dt, isPositionStep) {
    if(isPositionStep) {
        PointMassBody.verletPositionStep(bodies, dt);
    } else {
        PointMassBody.verletAccelerationStep(bodies, dt);
    }
};


fullofstars.createTwoTierSmartGravityApplicator = function(attractedCelestials, attractingCelestials) {
    var applicator = {};
    var attractingIsAttracted = attractingCelestials === attractedCelestials;

    var closeInteractions = _.map(attractedCelestials, function() { var arr = new Array(4); arr[0] = arr[1] = arr[2] = arr[3] = -1; return arr; });
    var closeInteractionCount = 0;

    var farForces = _.map(attractedCelestials, function() { return new THREE.Vector3(0, 0, 0); });

    var currentFarAttractedIndex = 0;

    var FAR_THRESHOLD_SQR = Math.pow(100 * fullofstars.UNIVERSE_SCALE_RECIPROCAL, 2); // TODO: Make this more related to mass and distance combined

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

    // // Returns: Whether this should be a close interaction
    // var addGravityToVector = function(body1, body2, vector) {
    //     // TODO: Inline and optimise
    //     var body1To2 = tempVec.subVectors(body2.position, body1.position);
    //     body1To2.multiplyScalar(fullofstars.UNIVERSE_SCALE_RECIPROCAL);
    //     var sqrDist = body1To2.lengthSq();
    //     var force = fullofstars.GRAVITATIONAL_CONSTANT * ((body1.mass*body2.mass) / (sqrDist + fullofstars.GRAVITY_EPSILON*fullofstars.GRAVITY_EPSILON));
    //     // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
    //     var forceOnBody = body1To2.setLength(force);
    //     if(sqrDist < FAR_THRESHOLD_SQR || body1.mass+body2.mass > fullofstars.TYPICAL_STAR_MASS * 100) {
    //         return true; // This should be handled as a close interaction
    //     }
    //     vector.add(forceOnBody);
    //     return false;
    // };

    applicator.handleCloseInteractions = function() {
        // Highly inlined for performance
        var typicalStarMass = fullofstars.TYPICAL_STAR_MASS;
        var universeScaleRecipr = fullofstars.UNIVERSE_SCALE_RECIPROCAL;
        var gravitationalConstant = fullofstars.GRAVITATIONAL_CONSTANT;
        var gravityEpsilon = fullofstars.GRAVITY_EPSILON;
        var gravityEpsilonSqrd = gravityEpsilon*gravityEpsilon;
        var GAS_INTERACTION_DISTANCE_SQRD = Math.pow(100 * universeScaleRecipr, 2);

        var body1To2X = 0.0, body1To2Y = 0.0; body1To2Z = 0.0;
        var relativeVelX = 0.0, relativeVelY = 0.0; relativeVelZ = 0.0;

        for(var i=0, outerLen=closeInteractions.length; i<outerLen; i++) {
            for(var innerI=0, innerLen=closeInteractions[i].length; innerI<innerLen; innerI++) {
                if(closeInteractions[i][innerI] === -1) {
                    continue;
                }
                var body1 = attractedCelestials[i];
                var body2 = attractingCelestials[closeInteractions[i][innerI]];

                var body1pos = body1.position;
                var body2pos = body2.position;

                var body1force = body1.force;
                var body2force = body2.force;

                var massSum = body1.mass + body2.mass;
                var massProduct = body1.mass * body2.mass;

                var isBlackHoleInteraction = massSum > (typicalStarMass * 100);

                // Calculate body1To2 and put into proper scale
                body1To2X = (body2pos.x - body1pos.x)*universeScaleRecipr;
                body1To2Y = (body2pos.y - body1pos.y)*universeScaleRecipr;
                body1To2Z = (body2pos.z - body1pos.z)*universeScaleRecipr;

                var sqrDist = body1To2X*body1To2X + body1To2Y*body1To2Y + body1To2Z*body1To2Z;
                var dist = Math.sqrt(sqrDist);

                var force = gravitationalConstant * ((massProduct) / (sqrDist + gravityEpsilon*gravityEpsilon));
                // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
                var setLengthMultiplier = force / dist;

                // Add force based on force amount and direction between bodies
                body1force.x += body1To2X * setLengthMultiplier;
                body1force.y += body1To2Y * setLengthMultiplier;
                body1force.z += body1To2Z * setLengthMultiplier;

                if(attractingIsAttracted); {
                    body2force.x -= body1To2X * setLengthMultiplier;
                    body2force.y -= body1To2Y * setLengthMultiplier;
                    body2force.z -= body1To2Z * setLengthMultiplier;
                }
                var isClose = sqrDist < FAR_THRESHOLD_SQR || isBlackHoleInteraction;

                if(!isBlackHoleInteraction) {
                    // Handle some sort of gas interaction
                    var gasForce = gravitationalConstant * (massProduct / (sqrDist + gravityEpsilonSqrd));
                    gasForce *= Math.pow(10, 9);
                    var body1vel = body1.velocity;
                    var body2vel = body2.velocity;

                    relativeVelX = body1vel.x - body2vel.x;
                    relativeVelY = body1vel.y - body2vel.y;
                    relativeVelZ = body1vel.z - body2vel.z;

                    body1force.x -= relativeVelX * gasForce;
                    body1force.y -= relativeVelY * gasForce;
                    body1force.z -= relativeVelZ * gasForce;

                    if(attractingIsAttracted); {
                        body2force.x += relativeVelX * gasForce;
                        body2force.y += relativeVelY * gasForce;
                        body2force.z += relativeVelZ * gasForce;
                    }
                }

                if(!isClose) {
                    // Remove this interaction
                    closeInteractions[i][innerI] = -1;
                    closeInteractionCount--;
                }
            }
        }
    };

    applicator.handleFarInteractions = function(bodyCountToUpdateFarForcesFor) {
        // Highly optimised and inlined for performance
        var typicalStarMass = fullofstars.TYPICAL_STAR_MASS;
        var universeScaleRecipr = fullofstars.UNIVERSE_SCALE_RECIPROCAL;
        var gravitationalConstant = fullofstars.GRAVITATIONAL_CONSTANT;
        var gravityEpsilon = fullofstars.GRAVITY_EPSILON;
        var gravityEpsilonSqrd = gravityEpsilon*gravityEpsilon;

        var body1To2X = 0.0, body1To2Y = 0.0; body1To2Z = 0.0;

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

                    // TODO: Make this code not insane

                    var interactions = closeInteractions[currentFarAttractedIndex];
                    var isCloseInteraction = false;

                    for(var closeInteractionIndex=0, closeInteractionLen=interactions.length; closeInteractionIndex<closeInteractionLen; closeInteractionIndex++) {
                        if(interactions[closeInteractionIndex] === attractingIndex) {
                          isCloseInteraction = true;
                          break;
                        }
                    }
                    if(!isCloseInteraction && attractingIsAttracted) {
                        // Need to make extra check when attracting is attracted - close interaction might be stored in other direction
                        // TODO: Maybe double-direction store close interactions for performance?
                        for(var closeInteractionIndex=0, closeInteractionLen=interactions.length; closeInteractionIndex<closeInteractionLen; closeInteractionIndex++) {
                            if(interactions[closeInteractionIndex] === attractingIndex) {
                              isCloseInteraction = true;
                              break;
                            }
                        }
                    }
                    if(!isCloseInteraction) {
                        // TODO: Inline and optimise
                        var body1 = attractedBody;
                        var body2 = attractingCelestials[attractingIndex];

                        var body1pos = body1.position;
                        var body2pos = body2.position;

                        body1To2X = (body2pos.x - body1pos.x) * universeScaleRecipr;
                        body1To2Y = (body2pos.y - body1pos.y) * universeScaleRecipr;
                        body1To2Z = (body2pos.z - body1pos.z) * universeScaleRecipr;

                        var sqrDist = body1To2X*body1To2X + body1To2Y*body1To2Y + body1To2Z*body1To2Z;
                        var dist = Math.sqrt(sqrDist);

                        var force = gravitationalConstant * ((body1.mass*body2.mass) / (sqrDist + gravityEpsilon*gravityEpsilon));
                        // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
                        var setLengthMultiplier = force / dist;

                        // Add force based on force amount and direction between bodies
                        farForce.x += body1To2X * setLengthMultiplier;
                        farForce.y += body1To2Y * setLengthMultiplier;
                        farForce.z += body1To2Z * setLengthMultiplier;

                        if(sqrDist < FAR_THRESHOLD_SQR || body1.mass+body2.mass > typicalStarMass * 100) {
                            isCloseInteraction = true; // This should be handled as a close interaction
                        }

                        if(isCloseInteraction) { //addGravityToVector(attractedBody, attractingCelestials[attractingIndex], farForce)) {
                            // Should turn this into a close interaction
                            for(var closeInteractionIndex=0, closeInteractionLen=interactions.length; closeInteractionIndex<closeInteractionLen; closeInteractionIndex++) {
                                if(interactions[closeInteractionIndex] === -1) {
                                    interactions[closeInteractionIndex] = attractingIndex;
                                    break;
                                }
                            }
                            if(closeInteractionIndex === closeInteractionLen) {
                                interactions.push(attractingIndex);
                            }
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




fullofstars.createGravitySystem = function(particleCount, typicalMass, makeBlackHole) {
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
            var mass = typicalMass * 2 * Math.random() * Math.random();
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
