// The public demo journal (account: test / test1234). Real, well-known places in Vadodara and
// Ahmedabad (from food guides: Culture Trip, MakeMyTrip, Swiggy, EazyDiner, Wanderlog, Outlook
// Traveller). Dishes are typical of each place; prices are approximate and the ratings, comments and
// order-again answers are made up so every feature has something to show.
// build-demo-sql.mjs turns this into db/migrations/2026-10-29-demo-account.sql (reset_demo()).
//
// dish: [name, price ₹, stars 1-5, order again (yes | maybe | no), comment]
// ago:  days since the visit (so "Newest" sorting and dates look natural)

const P = (name, city, area, categories, ago, dishes, directions = null) => ({
  name, city, area, categories, ago, directions,
  dishes: dishes.map(([n, price, rating, again, note]) => ({ name: n, price, rating, again, note })),
})
const V = 'Vadodara', A = 'Ahmedabad'

const vadodara = [
  P('Mandap', V, 'Express Hotel, Alkapuri', ['Food'], 4, [
    ['Gujarati Thali', 650, 5, 'yes', 'Unlimited and every item fresh. Dal and kadhi are perfect'],
    ['Aamras with Puri', 220, 4, 'yes', 'Only in mango season, sweet and thick'],
    ['Farsan Platter', 180, 3, 'maybe', 'Khandvi was good, patra a bit dry'],
  ], 'Inside Express Hotel, R C Dutt Road'),
  P('Sasumaa Gujarati Thali', V, 'Sayajigunj', ['Food'], 11, [
    ['Kathiyawadi Thali', 450, 5, 'yes', 'Homely taste, sev tameta was the best'],
    ['Bajra Rotla with Butter', 60, 4, 'yes', 'Smoky, goes great with lasan chutney'],
    ['Gulab Jamun', 80, 2, 'no', 'Too sweet and a little hard'],
  ]),
  P('Kai Asia', V, 'Alkapuri', ['Food'], 23, [
    ['Dim Sum Basket', 480, 4, 'yes', 'Crystal dumplings were delicate'],
    ['Thai Green Curry with Rice', 560, 5, 'yes', 'Fragrant, just the right spice'],
    ['Veg Sushi Roll', 520, 1, 'no', 'Rice was too sticky'],
    ['Steamed Veg Momos', 320, 3, 'maybe', 'Fine, but small portion for the price'],
  ], 'Inside Welcomhotel, R C Dutt Road'),
  P('22nd Parallel', V, 'Alkapuri', ['Food'], 6, [
    ['Kurmura Masala Dosa', 230, 5, 'yes', 'Crunchy puffed rice inside, unique'],
    ['Paniyaram (6 pcs)', 160, 4, 'yes', 'Orange and green chutney mix is the best'],
    ['Filter Coffee', 80, 4, 'maybe', 'Strong, served in a dabarah'],
    ['Rava Dosa', 210, 2, 'no', 'Came out soggy'],
  ]),
  P('Sankalp', V, 'Race Course Circle', ['Food'], 2, [
    ['Masala Dosa', 220, 5, 'yes', 'Crispy, perfect chutney and sambar'],
    ['Idli Sambar', 140, 4, 'yes', 'Soft idlis, hot sambar'],
    ['Paper Dosa', 260, 3, 'maybe', 'Looks great, taste is average'],
  ]),
  P('Shree Kamachi Bhavan', V, 'Fatehgunj', ['Food'], 31, [
    ['Medu Vada', 90, 5, 'yes', 'Crisp outside, fluffy inside'],
    ['Ghee Podi Idli', 120, 4, 'yes', 'Spicy podi with ghee, must try'],
    ['Uttapam', 130, 3, 'maybe', 'Thick, needed more onion'],
  ]),
  P('Peshawari', V, 'Welcomhotel, Alkapuri', ['Food'], 45, [
    ['Dal Peshawari', 750, 5, 'yes', 'Slow cooked, rich and smoky'],
    ['Paneer Tikka', 820, 4, 'maybe', 'Soft paneer, a little expensive'],
    ['Tandoori Roti', 120, 3, 'maybe', 'Good with the dal'],
  ]),
  P('Mirch Masala', V, 'Alkapuri', ['Food'], 19, [
    ['Paneer Butter Masala', 340, 4, 'yes', 'Creamy, mildly sweet gravy'],
    ['Butter Naan', 70, 3, 'maybe', 'Okay, a bit chewy'],
    ['Veg Biryani', 290, 2, 'no', 'Too oily, rice was mushy'],
  ]),
  P('Jassi De Parathe', V, 'Fatehgunj', ['Food'], 9, [
    ['Aloo Pyaz Paratha', 140, 5, 'yes', 'Huge, loads of butter'],
    ['Paneer Paratha', 170, 4, 'yes', 'Stuffed well, great with dahi'],
    ['Sweet Lassi', 90, 3, 'maybe', 'Thick but too sweet for me'],
  ]),
  P('Moti Mahal Delux', V, 'Alkapuri', ['Food'], 57, [
    ['Dal Makhani', 360, 4, 'yes', 'Buttery and smooth'],
    ['Paneer Tikka Masala', 390, 3, 'maybe', 'Gravy was average'],
    ['Lachha Paratha', 90, 4, 'yes', 'Flaky layers'],
  ]),
  P('Jay Mahakali Sev Usal', V, 'Kirti Stambh', ['Food'], 3, [
    ['Sev Usal', 60, 5, 'yes', 'Spicy, tangy, the Vadodara classic'],
    ['Extra Pav', 15, 3, 'maybe', 'Soft pav, nothing special'],
    ['Usal with Extra Sev', 70, 4, 'yes', 'More crunch, more fun'],
  ], 'Near Kirti Stambh, opposite the old court'),
  P('Raju Omelette', V, 'Karelibaug', ['Food'], 27, [
    ['Cheese Omelette', 120, 4, 'yes', 'Loaded with cheese'],
    ['Egg Bhurji Pav', 100, 5, 'yes', 'Masala is spot on'],
    ['Boiled Egg Fry', 90, 1, 'no', 'Too much oil'],
  ]),
  P('Jagdish Farsan', V, 'Mandvi', ['Food'], 14, [
    ['Lilo Chevdo', 120, 5, 'yes', 'The famous one, sweet and spicy'],
    ['Bhakarwadi', 110, 5, 'yes', 'Crisp and fresh, buy a box to take home'],
    ['Khaman', 80, 3, 'maybe', 'Soft, but sweeter than Ahmedabad style'],
  ]),
  P('Bhai Bhai Dabeliwala', V, 'Mandvi', ['Food'], 40, [
    ['Masala Dabeli', 30, 5, 'yes', 'Peanuts and pomegranate, perfect'],
    ['Cheese Dabeli', 50, 4, 'maybe', 'Cheese is extra, but good'],
    ['Butter Dabeli', 40, 3, 'maybe', 'Too much butter for me'],
  ]),
  P('Tasty Vadapav', V, 'Fatehgunj', ['Food'], 8, [
    ['Vada Pav', 30, 5, 'yes', 'Spicy, garlic chutney is the hero'],
    ['Cheese Vada Pav', 50, 3, 'maybe', 'Cheese hides the taste'],
    ['Samosa Pav', 35, 1, 'no', 'Samosa was cold'],
  ]),
  P('Chatkazz', V, 'Alkapuri', ['Food'], 16, [
    ['Pani Puri', 60, 4, 'yes', 'Six flavours of pani'],
    ['Pav Bhaji', 150, 4, 'yes', 'Buttery Mumbai style'],
    ['Veg Fried Momos', 130, 1, 'no', 'Oily and doughy'],
    ['Sev Puri', 80, 3, 'maybe', 'Fine, a bit too sweet'],
  ]),
  P('Moneez', V, 'Alkapuri', ['Food'], 35, [
    ['Margherita Pizza', 280, 3, 'maybe', 'Thin crust, needed more cheese'],
    ['Peri Peri Fries', 150, 4, 'yes', 'Crunchy and spicy'],
    ['Cold Coffee', 170, 4, 'yes', 'Thick and chilled'],
  ]),
  P('Flavour Restaurant', V, 'Sayajigunj', ['Food'], 50, [
    ['Fixed Gujarati Thali', 300, 4, 'yes', 'Value for money lunch'],
    ['Undhiyu (seasonal)', 220, 5, 'yes', 'Winter special, very good'],
    ['Dal Dhokli', 160, 3, 'maybe', 'Homely but bland'],
  ]),
  P('Govinda’s Restaurant', V, 'ISKCON, Gotri', ['Food', 'Healthy'], 21, [
    ['Sattvik Thali', 350, 4, 'yes', 'No onion garlic, still tasty'],
    ['Fruit Salad', 120, 4, 'yes', 'Fresh seasonal fruit'],
    ['Paneer Sabji', 180, 3, 'maybe', 'Mild for my taste'],
  ]),
  P('Khaki Dining Hall', V, 'Raopura', ['Food'], 66, [
    ['Unlimited Thali', 280, 4, 'yes', 'Old school, fast refills'],
    ['Kadhi Khichdi', 140, 5, 'yes', 'Comfort food, just like home'],
    ['Shrikhand', 90, 1, 'no', 'Too much sugar'],
  ]),
  P('Azure', V, 'Old Padra Road', ['Food'], 73, [
    ['Mezze Platter', 560, 4, 'maybe', 'Good hummus, pita was dry'],
    ['Alfredo Pasta', 480, 3, 'maybe', 'Creamy but heavy'],
    ['Wood Fired Pizza', 520, 5, 'yes', 'Best pizza in the city'],
  ]),
  P('Saideep Dabeli Corner', V, 'Manjalpur', ['Food'], 82, [
    ['Kutchi Dabeli', 30, 4, 'yes', 'Sweet and spicy balance'],
    ['Grilled Dabeli', 45, 3, 'maybe', 'Crispier, less masala'],
    ['Masala Chaas', 25, 4, 'yes', 'Cools you down'],
  ]),
  P('Canara Coffee House', V, 'Raopura', ['Food'], 95, [
    ['Mysore Masala Dosa', 140, 4, 'yes', 'Spicy red chutney inside'],
    ['Filter Coffee', 50, 5, 'yes', 'Old school, perfect froth'],
    ['Upma', 80, 2, 'no', 'Bland and dry'],
  ]),
  P('Barbeque Nation', V, 'Sarabhai Campus', ['Food'], 120, [
    ['Veg Buffet', 999, 4, 'maybe', 'Lots of starters, good for groups'],
    ['Grilled Pineapple', 150, 5, 'yes', 'Cinnamon pineapple is the best part'],
    ['Kulfi from the buffet', 120, 3, 'maybe', 'Decent, a bit icy'],
  ]),
  P('Subway', V, 'Alkapuri', ['Healthy'], 30, [
    ['Paneer Tikka Sub', 260, 3, 'maybe', 'Filling, sauce was heavy'],
    ['Veggie Delite Salad', 220, 4, 'yes', 'Light lunch, fresh veggies'],
    ['Corn and Peas Sub', 230, 2, 'no', 'Dry, needed more filling'],
  ]),
  // cafés
  P('Kaffa Coffee Roasters', V, 'Alkapuri', ['Cafe'], 1, [
    ['Pour Over Coffee', 220, 5, 'yes', 'Fruity and clean, best coffee in town'],
    ['Cold Brew', 240, 4, 'yes', 'Smooth, not bitter'],
    ['Banana Bread', 180, 3, 'maybe', 'Slightly dry'],
  ]),
  P('Kaphi Pibama', V, 'Alkapuri', ['Cafe'], 12, [
    ['Hazelnut Cold Coffee', 200, 4, 'yes', 'Less sweet, nice'],
    ['Cheese Garlic Bread', 180, 3, 'maybe', 'Okay, a bit oily'],
    ['Brownie with Ice Cream', 220, 5, 'yes', 'Warm and gooey'],
  ]),
  P('Cafe Local Patio', V, 'Alkapuri', ['Cafe', 'Healthy'], 25, [
    ['Quinoa Salad Bowl', 320, 4, 'yes', 'Fresh and filling'],
    ['Avocado Toast', 340, 3, 'maybe', 'Good, small portion'],
    ['Iced Americano', 180, 4, 'maybe', 'Strong and refreshing'],
  ]),
  P('Charmant – The Heritage Cafe', V, 'Alkapuri', ['Cafe'], 38, [
    ['Cappuccino', 190, 4, 'yes', 'Nice art, good body'],
    ['Pesto Sandwich', 290, 3, 'maybe', 'Pesto was light'],
    ['Tiramisu', 320, 2, 'no', 'Too much cream'],
  ]),
  P('Caffe De Rio', V, 'Akota', ['Cafe'], 18, [
    ['Mocha', 210, 4, 'yes', 'Chocolatey, calm place to work'],
    ['Penne Arrabbiata', 340, 4, 'maybe', 'Tangy, good portion'],
    ['Nachos', 260, 2, 'no', 'Stale chips'],
  ]),
  P('Coffee Clan', V, 'Akota', ['Cafe'], 61, [
    ['Irish Cold Coffee', 210, 3, 'maybe', 'Nice but too sweet'],
    ['Veg Club Sandwich', 230, 4, 'yes', 'Big and tasty'],
    ['Lemon Iced Tea', 150, 1, 'no', 'Tasted like syrup'],
  ]),
  P('Curators Coffee', V, 'Alkapuri', ['Cafe'], 7, [
    ['Frappe Mocha', 290, 5, 'yes', 'The best frappe I’ve had'],
    ['Croissant', 160, 4, 'maybe', 'Flaky, fresh'],
    ['Flat White', 220, 4, 'yes', 'Smooth and strong'],
  ]),
  P('Tea Trails', V, 'Alkapuri', ['Cafe'], 88, [
    ['Masala Chai', 90, 4, 'yes', 'Proper ginger kick'],
    ['Thai Iced Tea', 180, 2, 'no', 'Too milky'],
    ['Maska Bun', 80, 4, 'yes', 'Soft bun, loads of butter'],
  ]),
  // desserts
  P('Havmor Ice Cream', V, 'Alkapuri', ['Dessert'], 13, [
    ['Kesar Pista Kulfi', 70, 5, 'yes', 'Rich and creamy'],
    ['Chocolate Sundae', 180, 4, 'maybe', 'Heavy but worth it'],
    ['Butterscotch Cone', 60, 3, 'maybe', 'Classic, nothing new'],
  ]),
  P('Duliram Pedawala', V, 'Raopura', ['Dessert'], 47, [
    ['Kesar Peda', 680, 5, 'yes', 'The Vadodara peda, melts in the mouth'],
    ['Dry Fruit Peda', 760, 4, 'yes', 'Price per kg, great gift box'],
    ['Malai Barfi', 640, 3, 'maybe', 'Good but very sweet'],
  ]),
  P('Natural Ice Cream', V, 'Akota', ['Dessert'], 33, [
    ['Tender Coconut Ice Cream', 110, 5, 'yes', 'Real coconut pieces'],
    ['Sitaphal Ice Cream', 120, 5, 'yes', 'Seasonal, the best one'],
    ['Chikoo Ice Cream', 100, 2, 'no', 'Too grainy for me'],
  ]),
]

const ahmedabad = [
  P('Agashiye', A, 'House of MG, Lal Darwaja', ['Food'], 5, [
    ['Gujarati Thali', 1500, 5, 'yes', 'Rooftop dinner, the best thali experience'],
    ['Handmade Ice Cream', 150, 5, 'yes', 'Churned at the table'],
    ['Khichdi Kadhi', 180, 4, 'maybe', 'Simple and comforting'],
  ], 'Rooftop of the House of MG, opposite Sidi Saiyyed mosque'),
  P('Vishalla', A, 'Vasna', ['Food'], 29, [
    ['Village Thali', 900, 5, 'yes', 'Eaten on the floor under lanterns, lovely'],
    ['Bajra Rotla with Gol', 80, 4, 'yes', 'Rustic and filling'],
    ['Chaas', 40, 3, 'maybe', 'Thin but refreshing'],
  ], 'Opposite Vasna Tol Naka'),
  P('Gordhan Thal', A, 'SG Highway', ['Food'], 17, [
    ['Unlimited Gujarati Thali', 600, 5, 'yes', 'Quick refills, sweets were great'],
    ['Dal Dhokli', 180, 3, 'maybe', 'Sweet-sour, a bit runny'],
    ['Mohanthal', 120, 4, 'yes', 'Rich besan sweet'],
  ]),
  P('Iscon Thal', A, 'Iscon Cross Road', ['Food'], 41, [
    ['Kathiyawadi Thali', 550, 4, 'yes', 'Spicy and generous'],
    ['Lasaniya Bataka', 180, 4, 'maybe', 'Garlicky potatoes, so good'],
    ['Basundi', 120, 2, 'no', 'Too thick and sweet'],
  ]),
  P('Atithi Dining Hall', A, 'Bodakdev', ['Food'], 64, [
    ['Fixed Thali', 330, 4, 'yes', 'Best value thali in the area'],
    ['Puran Poli', 120, 3, 'maybe', 'Only on some days'],
    ['Kadhi', 60, 5, 'yes', 'Perfect sweet-sour kadhi'],
  ]),
  P('Earthen Oven', A, 'Fortune Landmark, Usmanpura', ['Food'], 99, [
    ['Dahi Kebab', 520, 5, 'yes', 'Melt in the mouth'],
    ['Dal Makhani', 480, 4, 'yes', 'Creamy and slow cooked'],
    ['Tandoori Paneer', 560, 3, 'maybe', 'Slightly dry'],
  ]),
  P('Bayleaf', A, 'Courtyard by Marriott, Ramdev Nagar', ['Food'], 110, [
    ['Paneer Lababdar', 620, 4, 'maybe', 'Rich gravy, pricey'],
    ['Garlic Naan', 140, 4, 'yes', 'Soft and garlicky'],
    ['Veg Biryani', 580, 1, 'no', 'Under-spiced'],
  ]),
  P('Patang', A, 'Ashram Road', ['Food'], 130, [
    ['Buffet Dinner', 1200, 3, 'maybe', 'The revolving view is the highlight'],
    ['Paneer Tikka', 450, 4, 'maybe', 'Nicely charred'],
    ['Gulab Jamun', 150, 3, 'maybe', 'Warm, decent'],
  ], 'Revolving restaurant near Nehru Bridge'),
  P('Swati Snacks', A, 'Law Garden', ['Food', 'Healthy'], 10, [
    ['Panki', 210, 5, 'yes', 'Steamed in banana leaf, so light'],
    ['Handvo', 190, 4, 'yes', 'Crisp edges, soft inside'],
    ['Sev Puri', 180, 3, 'maybe', 'Good but small'],
  ]),
  P('Das Khaman', A, 'Navrangpura', ['Food'], 20, [
    ['Khaman', 70, 5, 'yes', 'Spongy, the Ahmedabad benchmark'],
    ['Nylon Khaman', 80, 4, 'yes', 'Super soft and light'],
    ['Khandvi', 90, 3, 'maybe', 'A little thick'],
  ]),
  P('Sankalp', A, 'Ashram Road', ['Food'], 48, [
    ['Masala Dosa', 220, 4, 'yes', 'Where Sankalp started, still good'],
    ['Idli Sambar', 140, 3, 'maybe', 'Sambar was too sweet'],
    ['Onion Rava Dosa', 240, 5, 'yes', 'Lacy and crisp'],
  ]),
  P('Dasprakash', A, 'Ashram Road', ['Food'], 76, [
    ['Mysore Masala Dosa', 180, 4, 'yes', 'Spicy chutney layer'],
    ['Medu Vada', 110, 4, 'maybe', 'Crisp, a bit oily'],
    ['Filter Coffee', 70, 3, 'maybe', 'Okay coffee'],
  ]),
  P('Gwalia Sweets & Fast Food', A, 'SG Highway', ['Food', 'Dessert'], 36, [
    ['Chole Bhature', 200, 4, 'yes', 'Fluffy bhature'],
    ['Kaju Katli', 900, 5, 'yes', 'Price per kg, thin and perfect'],
    ['Pav Bhaji', 170, 3, 'maybe', 'Fine, nothing special'],
  ]),
  P('Manek Chowk', A, 'Old City', ['Food'], 25, [
    ['Butter Pav Bhaji', 160, 5, 'yes', 'Night market vibe, loads of butter'],
    ['Chocolate Sandwich', 120, 3, 'maybe', 'Weird but fun once'],
    ['Pineapple Sandwich', 110, 2, 'no', 'Too sweet'],
    ['Kulfi', 60, 4, 'yes', 'Perfect end to the night'],
  ], 'Night food market, best after 9:30 pm'),
  P('Chandravilas', A, 'Gandhi Road', ['Food'], 54, [
    ['Fafda Jalebi', 120, 5, 'yes', 'Sunday morning tradition'],
    ['Masala Chai', 30, 4, 'yes', 'Strong, sweet'],
    ['Dal Pakwan', 90, 2, 'no', 'Pakwan was not crisp'],
  ]),
  P('Honest', A, 'CG Road', ['Food'], 15, [
    ['Butter Pav Bhaji', 180, 4, 'yes', 'Loads of butter'],
    ['Masala Pav', 120, 4, 'maybe', 'Good with chaas'],
    ['Cheese Sandwich', 140, 1, 'no', 'Bread was stale'],
  ]),
  P('Jasuben Pizza', A, 'Navrangpura', ['Food'], 39, [
    ['Jasuben Special Pizza', 180, 4, 'yes', 'The classic thick-crust Ahmedabad pizza'],
    ['Cheese Corn Pizza', 200, 3, 'maybe', 'Sweet corn, a lot of cheese'],
    ['Garlic Bread', 120, 2, 'no', 'Soggy'],
  ]),
  P('Rajwadu', A, 'Jivraj Park', ['Food'], 140, [
    ['Rajwadi Thali', 800, 4, 'maybe', 'Lovely village setting'],
    ['Dal Baati', 240, 4, 'yes', 'Ghee soaked baati'],
    ['Malpua', 150, 3, 'maybe', 'Rich, a bit oily'],
  ]),
  P('Lucky Restaurant', A, 'Lal Darwaja', ['Food'], 92, [
    ['Maska Bun', 40, 4, 'yes', 'With chai, among the old graves'],
    ['Masala Chai', 25, 5, 'yes', 'The famous Lucky chai'],
    ['Veg Puff', 35, 2, 'no', 'Dry'],
  ]),
  P('Tomato’s', A, 'CG Road', ['Food'], 160, [
    ['Veg Burger', 220, 3, 'maybe', 'Retro diner feel'],
    ['Pasta in Pink Sauce', 320, 4, 'yes', 'Creamy and tangy'],
    ['Oreo Shake', 210, 4, 'yes', 'Thick shake'],
  ]),
  P('Oshwal’s Fafda Jalebi', A, 'Navrangpura', ['Food'], 70, [
    ['Fafda', 70, 4, 'yes', 'Crisp, with papaya sambharo'],
    ['Jalebi', 80, 5, 'yes', 'Hot and crisp'],
    ['Methi Gota', 60, 3, 'maybe', 'Good but oily'],
  ]),
  P('Gopi Dining Hall', A, 'Ellisbridge', ['Food'], 105, [
    ['Gujarati Thali', 400, 5, 'yes', 'Old favourite, fast service'],
    ['Rotli with Ghee', 20, 4, 'yes', 'Thin and soft'],
    ['Mag ni Dal', 70, 3, 'maybe', 'Simple'],
  ]),
  P('Barbeque Nation', A, 'Satellite', ['Food'], 150, [
    ['Veg Buffet', 999, 3, 'maybe', 'Starters are better than mains'],
    ['Cajun Potatoes', 120, 5, 'yes', 'Addictive'],
    ['Phirni', 100, 2, 'no', 'Bland'],
  ]),
  // cafés
  P('Starbucks', A, 'Navrangpura', ['Cafe'], 3, [
    ['Java Chip Frappuccino', 340, 4, 'yes', 'Sweet treat'],
    ['Cafe Americano', 260, 3, 'maybe', 'Fine, nothing special'],
    ['Paneer Tikka Sandwich', 310, 2, 'no', 'Too small for the price'],
  ]),
  P('All The Perks', A, 'Navrangpura', ['Cafe'], 22, [
    ['Spanish Latte', 260, 5, 'yes', 'Silky and sweet'],
    ['Cold Coffee', 220, 4, 'yes', 'Classic, not too sweet'],
    ['Cream Cheese Bagel', 280, 3, 'maybe', 'Decent'],
  ]),
  P('Mleko', A, 'Navrangpura', ['Cafe', 'Healthy'], 44, [
    ['Acai Bowl', 420, 4, 'yes', 'Fresh fruit, light'],
    ['Greek Salad', 360, 4, 'maybe', 'Good feta'],
    ['Cappuccino', 210, 3, 'maybe', 'Average'],
  ]),
  P('Danny’s Coffee Bar', A, 'Navrangpura', ['Cafe'], 58, [
    ['Cold Coffee with Ice Cream', 230, 4, 'yes', 'Big glass'],
    ['Veg Grilled Sandwich', 190, 3, 'maybe', 'Okay'],
    ['Mocha', 220, 2, 'no', 'Too bitter'],
  ]),
  P('Brewgarten', A, 'Navrangpura', ['Cafe'], 80, [
    ['Iced Latte', 240, 4, 'yes', 'Nice place to sit'],
    ['Pesto Pasta', 380, 3, 'maybe', 'A bit oily'],
    ['Waffle with Maple', 290, 5, 'yes', 'Crisp and fluffy'],
  ]),
  P('Third Wave Coffee', A, 'Prahladnagar', ['Cafe'], 9, [
    ['Cold Brew Tonic', 290, 4, 'yes', 'Fizzy and fresh'],
    ['Hazelnut Cold Coffee', 280, 5, 'yes', 'Smooth'],
    ['Chocolate Croissant', 220, 3, 'maybe', 'Fine'],
  ]),
  P('Slay Coffee', A, 'Prahladnagar', ['Cafe'], 33, [
    ['Iced Mocha', 180, 3, 'maybe', 'Good for the price'],
    ['Cold Coffee', 160, 4, 'yes', 'Quick and tasty'],
    ['Veg Puff', 80, 1, 'no', 'Cold and soggy'],
  ]),
  P('Unlocked', A, 'Navrangpura', ['Cafe'], 115, [
    ['Nachos Grande', 320, 4, 'yes', 'Great with board games'],
    ['Margherita Pizza', 380, 3, 'maybe', 'Okay pizza, fun place'],
    ['Oreo Shake', 240, 4, 'maybe', 'Thick'],
  ]),
  P('Zen Cafe', A, 'Gulbai Tekra', ['Cafe', 'Healthy'], 52, [
    ['Hummus with Pita', 280, 4, 'yes', 'Smooth hummus'],
    ['Herbal Iced Tea', 150, 3, 'maybe', 'Light'],
    ['Sprouts Salad', 220, 4, 'yes', 'Fresh and crunchy'],
  ]),
  P('Upper Crust', A, 'CG Road', ['Cafe'], 170, [
    ['Bagel Sandwich', 240, 3, 'maybe', 'Okay bagel'],
    ['Chocolate Truffle Pastry', 160, 5, 'yes', 'Dense and rich'],
    ['Cappuccino', 180, 4, 'maybe', 'Good'],
  ]),
  // desserts
  P('Havmor Ice Cream', A, 'Navrangpura', ['Dessert'], 18, [
    ['Kesar Pista Kulfi', 70, 5, 'yes', 'Rich and creamy, where Havmor began'],
    ['Belgian Chocolate Scoop', 120, 4, 'yes', 'Very chocolatey'],
    ['Sitaphal Sundae', 190, 2, 'no', 'Too sweet'],
  ]),
  P('Hocco Eatery', A, 'Thaltej', ['Dessert'], 60, [
    ['Kulfi Falooda', 180, 4, 'yes', 'Cold and filling'],
    ['Brownie Sundae', 220, 5, 'yes', 'Warm brownie with ice cream'],
    ['Pav Bhaji', 210, 2, 'no', 'Stick to the desserts here'],
  ]),
  P('Vadilal Happinezz Cafe', A, 'Satellite', ['Dessert'], 125, [
    ['Rajbhog Ice Cream', 110, 4, 'yes', 'Saffron and nuts'],
    ['Thick Shake', 180, 3, 'maybe', 'Good but heavy'],
    ['Waffle Cone', 90, 1, 'no', 'Cone was stale'],
  ]),
]

export const SEED = {
  places: [...vadodara, ...ahmedabad],
  wishlist: [
    { name: 'Cafe Mocha', city: V, area: 'Alkapuri', categories: ['Cafe'], note: 'Late night coffee spot' },
    { name: 'Devi’s Coffee Bar', city: V, area: 'Alkapuri', categories: ['Cafe'], note: 'Riya says the cold brew is great' },
    { name: 'Karma Cafe', city: A, area: 'Navrangpura', categories: ['Cafe'], note: 'Brunch place to try' },
    { name: 'Sagar Ratna', city: A, area: 'Ashram Road', categories: ['Food'], note: 'South Indian, ask for the thali' },
    { name: 'The Grand Bhagwati', city: A, area: 'SG Highway', categories: ['Food'], note: 'Gujarati thali for family dinner' },
    { name: 'Laxmi Vilas Palace Café', city: V, area: 'Laxmi Vilas Palace', categories: ['Cafe', 'Dessert'], note: 'Coffee after the palace tour' },
  ],
  group: {
    name: 'Weekend Foodies',
    places: [
      P('Agashiye', A, 'House of MG, Lal Darwaja', ['Food'], 6, [
        ['Gujarati Thali', 1500, 5, 'yes', 'Best rooftop thali'],
        ['Handmade Ice Cream', 150, 4, 'yes', 'Churned at the table'],
      ]),
      P('Jagdish Farsan', V, 'Mandvi', ['Food'], 12, [
        ['Lilo Chevdo', 120, 5, 'yes', 'Bought two boxes'],
        ['Bhakarwadi', 110, 4, 'yes', 'Crisp'],
      ]),
      P('Manek Chowk', A, 'Old City', ['Food'], 20, [
        ['Butter Pav Bhaji', 160, 4, 'yes', 'Midnight treat'],
        ['Chocolate Sandwich', 120, 2, 'no', 'Never again'],
      ]),
      P('Kaffa Coffee Roasters', V, 'Alkapuri', ['Cafe'], 3, [
        ['Pour Over Coffee', 220, 5, 'yes', 'Order this, trust me'],
        ['Cold Brew', 240, 4, 'maybe', 'Smooth'],
      ]),
      P('Havmor Ice Cream', A, 'Navrangpura', ['Dessert'], 9, [
        ['Kesar Pista Kulfi', 70, 5, 'yes', 'Always'],
        ['Belgian Chocolate Scoop', 120, 3, 'maybe', 'Too rich'],
      ]),
    ].map(p => ({ ...p, dishes: p.dishes.map((d, i) => ({ ...d,
      reactions: i === 0 ? ['🔥', '😋'] : [],
      comments: i === 0 ? ['Next time we order two of these!'] : [],
    })) })),
    wishlist: [
      { name: 'Vishalla', city: A, area: 'Vasna', categories: ['Food'], note: 'Group dinner one evening' },
      { name: 'Mahakali Sev Usal', city: V, area: 'Kirti Stambh', categories: ['Food'], note: 'Breakfast run' },
    ],
  },
}
