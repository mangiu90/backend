const { test, after, beforeEach, describe } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const supertest = require('supertest')
const app = require('../app')
const helper = require('./test_helper')
const bcrypt = require('bcrypt')
const User = require('../models/user')

const api = supertest(app)

describe('when there is initially one user in db', () => {
  beforeEach(async () => {
    await User.deleteMany({})

    const passwordHash = await bcrypt.hash('sekret', 10)
    const user = new User({ username: 'root', name: 'Superuser', passwordHash })

    await user.save()
  })

  test('creation succeeds with a fresh username', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'mluukkai',
      name: 'Matti Luukkainen',
      password: 'salainen',
    }

    await api
      .post('/api/users')
      .send(newUser)
      .expect(201)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    assert.strictEqual(usersAtEnd.length, usersAtStart.length + 1)

    const usernames = usersAtEnd.map(u => u.username)
    assert(usernames.includes(newUser.username))
  })

  test('creation fails with proper statuscode and message if username already taken', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'root',
      name: 'Superuser',
      password: 'salainen',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    assert(result.body.error.includes('expected `username` to be unique'))

    assert.strictEqual(usersAtEnd.length, usersAtStart.length)
  })

  test('succeeds with valid credentials', async () => {
    const loginDetails = {
      username: 'root',
      password: 'sekret',
    }
    const response = await api
      .post('/api/login')
      .send(loginDetails)
      .expect(200)
      .expect('Content-Type', /application\/json/)

    assert(response.body.token)
    assert.strictEqual(response.body.username, 'root')
    assert.strictEqual(response.body.name, 'Superuser')
  })

  test('fails with invalid password', async () => {
    const loginDetails = {
      username: 'root',
      password: 'wrongpassword',
    }
    const response = await api
      .post('/api/login')
      .send(loginDetails)
      .expect(401)
      .expect('Content-Type', /application\/json/)

    assert(response.body.error.includes('invalid username or password'))
    assert(!response.body.token)
  })

  test('fails with non-existing user', async () => {
    const loginDetails = {
      username: 'nouser',
      password: 'irrelevant',
    }
    const response = await api
      .post('/api/login')
      .send(loginDetails)
      .expect(401)
      .expect('Content-Type', /application\/json/)

    assert(response.body.error.includes('invalid username or password'))
    assert(!response.body.token)
  })
})

after(async () => {
  await mongoose.connection.close()
})