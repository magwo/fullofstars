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


fullofstars.applyBruteForceNewtonianGravity = function(celestials, dt) {
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