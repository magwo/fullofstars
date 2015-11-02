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
    var applicator = {closeInteractionCount: 0};
    var attractingIsAttracted = attractingCelestials === attractedCelestials;

    var closeInteractions = _.map(attractedCelestials, function() { var arr = new Array(4); arr[0] = arr[1] = arr[2] = arr[3] = -1; return arr; });
    var closeInteractionCount = 0;

    var farForces = _.map(attractedCelestials, function() { return new THREE.Vector3(0, 0, 0); });

    var currentFarAttractedIndex = 0;

    var FAR_THRESHOLD_SQR = Math.pow(40 * fullofstars.UNIVERSE_SCALE_RECIPROCAL, 2); // TODO: Make this more related to mass and distance combined
    var GAS_INTERACTION_DISTANCE_SQRD = Math.pow(30 * fullofstars.UNIVERSE_SCALE_RECIPROCAL, 2);

    applicator.handleCloseInteractions = function() {
        // Highly inlined for performance
        var typicalStarMass = fullofstars.TYPICAL_STAR_MASS;
        var universeScaleRecipr = fullofstars.UNIVERSE_SCALE_RECIPROCAL;
        var gravitationalConstant = fullofstars.GRAVITATIONAL_CONSTANT;
        var gravityEpsilon = fullofstars.GRAVITY_EPSILON;
        var gravityEpsilonSqrd = gravityEpsilon*gravityEpsilon;


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

                var isBlackHoleInteraction = body1.mass > typicalStarMass * 100 || body2.mass > typicalStarMass * 100;

                // Calculate body1To2 and put into proper scale
                body1To2X = (body2pos.x - body1pos.x)*universeScaleRecipr;
                body1To2Y = (body2pos.y - body1pos.y)*universeScaleRecipr;
                body1To2Z = (body2pos.z - body1pos.z)*universeScaleRecipr;

                var sqrDist = body1To2X*body1To2X + body1To2Y*body1To2Y + body1To2Z*body1To2Z;
                var dist = Math.sqrt(sqrDist);

                var force = gravitationalConstant * ((massProduct*dist) / Math.pow(sqrDist + gravityEpsilonSqrd, 3/2));

                 if(isBlackHoleInteraction) {
                    // Apply fake dark matter effect from black hole
                    var DARK_FORCE_COEFFICIENT = 4*Math.pow(10, -20);
                    var darkForce = DARK_FORCE_COEFFICIENT * gravitationalConstant * (massProduct / dist);
                    force += darkForce;
                }

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

                ///console.log("gas?", sqrDist, GAS_INTERACTION_DISTANCE_SQRD);
                if(!isBlackHoleInteraction && sqrDist < GAS_INTERACTION_DISTANCE_SQRD) {
                    // Handle some sort of gas interaction
                    var gasForce = (dist) / Math.pow(sqrDist + gravityEpsilonSqrd, 3/2);
                    gasForce *= Math.pow(10, 19);
                    var body1vel = body1.velocity;
                    var body2vel = body2.velocity;

                    relativeVelX = body1vel.x - body2vel.x;
                    relativeVelY = body1vel.y - body2vel.y;
                    relativeVelZ = body1vel.z - body2vel.z;

                    body1force.x -= relativeVelX * gasForce * body1.mass;
                    body1force.y -= relativeVelY * gasForce * body1.mass;
                    body1force.z -= relativeVelZ * gasForce * body1.mass;

                    if(attractingIsAttracted); {
                        body2force.x += relativeVelX * gasForce * body2.mass;
                        body2force.y += relativeVelY * gasForce * body2.mass;
                        body2force.z += relativeVelZ * gasForce * body2.mass;
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

                        var force = gravitationalConstant * ((body1.mass*body2.mass*dist) / Math.pow(sqrDist + gravityEpsilon*gravityEpsilon, 3/2));
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
        applicator.handleCloseInteractions();
        applicator.handleFarInteractions(bodyCountToUpdateFarForcesFor);
        applicator.applyFarForces();
        applicator.closeInteractionCount = closeInteractionCount;
    };
    return applicator;
}




fullofstars.createGravitySystem = function(particleCount, typicalMass, makeBlackHole) {
    var bodies = [];

    var typicalStarSpeed = 7*Math.pow(10, 10) * fullofstars.UNIVERSE_SCALE;
    console.log("typical star speed", typicalStarSpeed);
    var side = 2300.0;

    var BLACK_HOLE_MASS = fullofstars.TYPICAL_STAR_MASS * 5000;

    for (var p = 0; p < particleCount; p++) {
        var angle = 100 + Math.PI * 2 * Math.random();

        // This creates density variations angularly
        angle += 0.10 * Math.sin(angle * Math.PI*2);
        
        var dist = side * 0.5 * Math.random();
        dist += side * 0.04 * -Math.cos(angle * Math.PI*2);

        var pX = dist * Math.cos(angle);
        var pY = pX * 0.2 + 0.9*(side*side*0.01/(dist+side*0.1)) * (-.5 + Math.random());
        var pZ = dist * Math.sin(angle);




        if(makeBlackHole && p === 0) {
          console.log("Creating black hole");
            var pos = new THREE.Vector3(0,0,0);
            var mass = BLACK_HOLE_MASS;
            var xVel = 0;
            var yVel = 0;
        }
        else {
            var pos = new THREE.Vector3(pX, pY, pZ);
            var mass = typicalMass * 2 * Math.random() * Math.random();
            

            // This is newtonian and only works with no dark matter presence
            //var requiredSpeed = fullofstars.UNIVERSE_SCALE *0.3 * speedNeededForCircularOrbit(mass, BLACK_HOLE_MASS, pos.length());//(ourMass, otherBodyMass, distance)
            
            var vel = new THREE.Vector3(pX, pY, pZ);
            vel.normalize();
            var requiredSpeed = typicalStarSpeed * 1.8 + typicalStarSpeed * 0.1 * Math.log(1.1+(10*dist/side));

            var xVel = vel.z * requiredSpeed;
            var yVel = vel.y * requiredSpeed;
            var zVel = -vel.x * requiredSpeed;
        }
        var body = new PointMassBody(mass, pos, new THREE.Vector3(xVel, yVel, zVel));
        bodies.push(body);
    }
    return bodies;
};


})();
