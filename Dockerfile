# Use the official, lightweight Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your backend code
COPY . .

# Expose the port your Express server runs on (e.g., 5000)
EXPOSE 5000

# Command to start your application
CMD [ "node", "server.js" ]