import { describe, expect, test } from 'vitest'
import { parseSpoken } from './voiceParse'

const dish = (name, price = '', rating = 0, note = '', order_again = '') => ({ name, price, rating, note, order_again })

describe('parseSpoken: what you said -> place + dishes', () => {
  test('the example with pauses (each pause is a separate piece)', () => {
    expect(parseSpoken(['Sankalp', 'masala dosa 180 rupees 5 stars crispy'])).toEqual({
      place: 'Sankalp', dishes: [dish('Masala Dosa', '180', 5, 'Crispy')],
    })
  })

  test('the example said with commas', () => {
    expect(parseSpoken(['Sankalp, masala dosa, 180 rupees, 5 stars, crispy'])).toEqual({
      place: 'Sankalp', dishes: [dish('Masala Dosa', '180', 5, 'Crispy')],
    })
  })

  test('no pauses at all: the food dictionary finds where the dish starts', () => {
    expect(parseSpoken(['sankalp masala dosa 180 rupees 5 stars crispy'])).toEqual({
      place: 'Sankalp', dishes: [dish('Masala Dosa', '180', 5, 'Crispy')],
    })
  })

  test('a place you already have is recognised at the start', () => {
    const r = parseSpoken(['coffea brew on the rocks hazelnut shake 200 rs 4 star'], ['Coffea Brew on the Rocks'])
    expect(r.place).toBe('Coffea Brew on the Rocks')
    expect(r.dishes).toEqual([dish('Hazelnut Shake', '200', 4)])
  })

  test('"at <place>" works too', () => {
    expect(parseSpoken(['paneer tikka at Barbeque Nation 350 rupees 4 stars']).place).toBe('Barbeque Nation')
  })

  test('only dishes, no place', () => {
    expect(parseSpoken(['cold coffee 120 rupees 4 stars too sweet'])).toEqual({
      place: null, dishes: [dish('Cold Coffee', '120', 4, 'Too sweet')],
    })
  })

  test('several dishes split by "next"', () => {
    expect(parseSpoken(['idli 60 rupees 4 stars soft next vada 50 rupees 3 stars oily']).dishes).toEqual([
      dish('Idli', '60', 4, 'Soft'), dish('Vada', '50', 3, 'Oily'),
    ])
  })

  test('several dishes split by pauses', () => {
    expect(parseSpoken(['idli', '60 rupees', '4 stars', 'soft', 'vada', '50 rupees', '3 stars']).dishes).toEqual([
      dish('Idli', '60', 4, 'Soft'), dish('Vada', '50', 3),
    ])
  })

  test('a second dish said in one breath starts at its price', () => {
    expect(parseSpoken(['masala dosa 180 rupees 5 stars crispy idli 80 rupees 4 stars soft']).dishes).toEqual([
      dish('Masala Dosa', '180', 5, 'Crispy'), dish('Idli', '80', 4, 'Soft'),
    ])
  })

  test('Indian ways of saying the price', () => {
    const price = s => parseSpoken([s]).dishes[0].price
    expect(price('chai rs 20')).toBe('20')
    expect(price('chai ₹20')).toBe('20')
    expect(price('chai 20 rupaye')).toBe('20')
    expect(price('chai 20rs')).toBe('20')
    expect(price('thali two hundred fifty rupees')).toBe('250')
    expect(price('thali 2 hundred rupees')).toBe('200')
  })

  test('a bare number above 5 is the price', () => {
    expect(parseSpoken(['pav bhaji 140 4 stars']).dishes[0]).toEqual(dish('Pav Bhaji', '140', 4))
  })

  test('stars in words, Hindi/Gujarati numbers and "out of 5"', () => {
    const stars = s => parseSpoken([s]).dishes[0].rating
    expect(stars('dabeli 30 rupees five stars')).toBe(5)
    expect(stars('dabeli 30 rupees paanch star')).toBe(5)
    expect(stars('dabeli 30 rupees char stars')).toBe(4)
    expect(stars('dabeli 30 rupees 3 out of 5')).toBe(3)
    expect(stars('dabeli 30 rupees rating 2')).toBe(2)
    expect(stars('dabeli 30 rupees 9 stars')).toBe(5)
  })

  test('order again, in English or Hinglish', () => {
    const again = s => parseSpoken([s]).dishes[0].order_again
    expect(again('vada pav 25 rupees 5 stars will order again')).toBe('yes')
    expect(again('vada pav 25 rupees 5 stars dobara lenge')).toBe('yes')
    expect(again('vada pav 25 rupees 2 stars never again')).toBe('no')
    expect(again('vada pav 25 rupees 3 stars')).toBe('')
  })

  test('the order-again words do not end up in the comment', () => {
    expect(parseSpoken(['vada pav 25 rupees 5 stars spicy will order again']).dishes[0].note).toBe('Spicy')
  })

  test('nothing useful said', () => {
    expect(parseSpoken([])).toEqual({ place: null, dishes: [] })
    expect(parseSpoken(['  '])).toEqual({ place: null, dishes: [] })
  })

  test('just a place name is kept as the place', () => {
    expect(parseSpoken(['Sankalp'])).toEqual({ place: 'Sankalp', dishes: [] })
  })

  test('prices are capped at 4 digits like the form', () => {
    expect(parseSpoken(['party platter 25000 rupees 4 stars']).dishes[0].price).toBe('9999')
  })
})
