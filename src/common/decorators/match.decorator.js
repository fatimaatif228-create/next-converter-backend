import { registerDecorator } from "class-validator";

// property: "password"
// propertyName: "confirmPassword"
export function Match(property) {
    return function (object, propertyName) {
        registerDecorator({
            name: 'match',
            target: object.constructor,
            propertyName: propertyName,
            constraints: [property],
            validator: {
                validate(value, args) {
                    return value === args.object[property]; // compares the actual values in password and confirmPassword
                },

                defaultMessage() { // if it fails print this message
                    return `${propertyName} must match ${property}`
                }
            }
        })
    }
}