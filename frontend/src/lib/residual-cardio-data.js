// frontend/src/lib/residual-cardio-data.js
// 26 exercises kept from the old dataset that have no SmartWorkout equivalent
// (verified 2026-09-24: only burpee, jump rope and mountain climber overlap —
// those are dropped in favor of their SmartWorkout entries).
function mk(id, name, equipments, tg, en, fr, img, gif) {
  return {
    id, name, body_part: 'CARDIO', equipments,
    laterality: 'BILATERAL', mechanics: null, weight_type: equipments.length ? null : 'BODYWEIGHT',
    tags: ['CARDIO'], exercise_muscles: null,
    description: null, description_fr: null,
    instructions: { en, fr }, tips: null, common_mistakes: null,
    video_dark_url: null, video_light_url: null, local_video: null,
    image_url: null, img, gif,
    n: name, bp: 'CARDIO', tg, eq: equipments.length ? equipments[0] : 'body weight',
  }
}

export const RESIDUAL_CARDIO = [
  mk('3220', 'astride jumps (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees and lower your body into a squat position.", "Jump explosively upwards, extending your legs and arms.", "While in the air, spread your legs apart and bring your arms out to the sides.", "Land softly with your feet shoulder-width apart, bending your knees to absorb the impact.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez les genoux et abaissez le corps en position de squat.", "Sautez explosivement vers le haut en étendant les jambes et les bras.", "En l'air, écartez les jambes et ouvrez les bras sur les côtés.", "Atterrissez en douceur, pieds écartés à la largeur des épaules, en fléchissant les genoux pour amortir l'impact.", "Répétez pour le nombre de répétitions souhaité."],
    '3220-f9lVSSI.jpg', '3220-f9lVSSI.gif'),

  mk('3672', 'back and forth step', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Step forward with your right foot, bending your knee and lowering your body into a lunge position.", "Push off with your right foot and step back to the starting position.", "Repeat the movement with your left foot, alternating legs with each step.", "Continue stepping back and forth, maintaining a steady pace.", "Repeat for the desired duration or number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Avancez le pied droit en fléchissant le genou pour descendre en fente.", "Repoussez avec le pied droit pour revenir à la position de départ.", "Répétez le mouvement avec le pied gauche, en alternant les jambes à chaque pas.", "Continuez à avancer et reculer en gardant un rythme régulier.", "Répétez pour la durée ou le nombre de répétitions souhaité."],
    '3672-fNGumX0.jpg', '3672-fNGumX0.gif'),

  mk('3360', 'bear crawl', [], 'cardiovascular system',
    ["Start on all fours with your hands directly under your shoulders and your knees directly under your hips.", "Lift your knees slightly off the ground, keeping your back flat and your core engaged.", "Move your right hand and left foot forward simultaneously, followed by your left hand and right foot.", "Continue crawling forward, alternating your hand and foot movements.", "Maintain a steady pace and keep your core tight throughout the exercise.", "Continue for the desired distance or time."],
    ["Placez-vous à quatre pattes, mains sous les épaules, genoux sous les hanches.", "Soulevez légèrement les genoux du sol en gardant le dos plat et le gainage engagé.", "Avancez simultanément la main droite et le pied gauche, puis la main gauche et le pied droit.", "Continuez à ramper vers l'avant en alternant mains et pieds.", "Maintenez un rythme régulier et gardez le tronc gainé pendant tout l'exercice.", "Continuez sur la distance ou la durée souhaitée."],
    '3360-0Yz8WdV.jpg', '3360-0Yz8WdV.gif'),

  mk('2331', 'cycle cross trainer', ['leverage machine'], 'cardiovascular system',
    ["Adjust the seat height and position yourself on the cycle cross trainer.", "Place your feet on the pedals and grip the handlebars.", "Start pedaling in a smooth and controlled motion.", "Maintain a steady pace and increase the resistance if desired.", "Continue pedaling for the desired duration of your cardio workout."],
    ["Réglez la hauteur et la position de la selle du vélo elliptique.", "Placez vos pieds sur les pédales et saisissez les poignées.", "Commencez à pédaler d'un mouvement fluide et contrôlé.", "Maintenez un rythme régulier et augmentez la résistance si souhaité.", "Continuez à pédaler pendant la durée souhaitée de votre séance cardio."],
    '2331-XSCHmiI.jpg', '2331-XSCHmiI.gif'),

  mk('1201', 'dumbbell burpee', ['dumbbell'], 'cardiovascular system',
    ["Start in a standing position with your feet shoulder-width apart and a dumbbell in each hand.", "Lower your body into a squat position, placing the dumbbells on the ground in front of you.", "Kick your feet back into a push-up position, keeping your body in a straight line.", "Perform a push-up, bending your elbows and lowering your chest towards the ground.", "Jump your feet back towards your hands, landing in a squat position.", "Stand up explosively, lifting the dumbbells off the ground and bringing them to your shoulders.", "Press the dumbbells overhead, fully extending your arms.", "Lower the dumbbells back to your shoulders and repeat the entire sequence for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules, un haltère dans chaque main.", "Abaissez le corps en position de squat en posant les haltères au sol devant vous.", "Ramenez les pieds en arrière pour rejoindre une position de pompe, corps aligné.", "Effectuez une pompe en fléchissant les coudes et en descendant la poitrine vers le sol.", "Ramenez les pieds vers les mains en atterrissant en position de squat.", "Relevez-vous explosivement en soulevant les haltères jusqu'aux épaules.", "Poussez les haltères au-dessus de la tête en tendant complètement les bras.", "Redescendez les haltères aux épaules et répétez la séquence complète pour le nombre de répétitions souhaité."],
    '1201-0JtKWum.jpg', '1201-0JtKWum.gif'),

  mk('3221', 'half knee bends (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees and lower your body down as if you were sitting back into a chair.", "Keep your chest up and your weight in your heels.", "Pause for a moment at the bottom, then push through your heels to return to the starting position.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez les genoux et abaissez le corps comme pour vous asseoir sur une chaise.", "Gardez la poitrine relevée et le poids sur les talons.", "Marquez une pause en bas, puis poussez sur les talons pour revenir à la position de départ.", "Répétez pour le nombre de répétitions souhaité."],
    '3221-ia6kIIl.jpg', '3221-ia6kIIl.gif'),

  mk('3636', 'high knee against wall', [], 'cardiovascular system',
    ["Stand facing a wall with your feet hip-width apart.", "Place your hands on the wall for support.", "Engage your core and lift your right knee up towards your chest, while keeping your left foot on the ground.", "Quickly switch legs, bringing your left knee up towards your chest and lowering your right foot back down.", "Continue alternating legs in a running motion, bringing your knees up as high as possible.", "Maintain a fast pace and keep your upper body stable throughout the exercise.", "Repeat for the desired duration or number of repetitions."],
    ["Tenez-vous debout face à un mur, pieds écartés à la largeur des hanches.", "Posez les mains sur le mur pour vous soutenir.", "Gainez le tronc et levez le genou droit vers la poitrine, en gardant le pied gauche au sol.", "Changez rapidement de jambe, en levant le genou gauche vers la poitrine et en reposant le pied droit.", "Continuez à alterner les jambes dans un mouvement de course, en montant les genoux le plus haut possible.", "Maintenez un rythme rapide et gardez le haut du corps stable pendant tout l'exercice.", "Répétez pour la durée ou le nombre de répétitions souhaité."],
    '3636-ealLwvX.jpg', '3636-ealLwvX.gif'),

  mk('0501', 'jack burpee', [], 'cardiovascular system',
    ["Start in a standing position with your feet shoulder-width apart.", "Lower your body into a squat position, placing your hands on the ground in front of you.", "Kick your feet back, landing in a push-up position.", "Perform a push-up, lowering your chest to the ground and then pushing back up.", "Jump your feet forward, landing in a squat position.", "Jump up explosively, reaching your arms overhead.", "Land softly and immediately lower back into the squat position to begin the next repetition."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Abaissez le corps en position de squat en posant les mains au sol devant vous.", "Ramenez les pieds en arrière pour atterrir en position de pompe.", "Effectuez une pompe en descendant la poitrine vers le sol puis en repoussant.", "Ramenez les pieds vers l'avant en atterrissant en position de squat.", "Sautez explosivement vers le haut en tendant les bras au-dessus de la tête.", "Atterrissez en douceur et redescendez immédiatement en position de squat pour la répétition suivante."],
    '0501-mr7pkqP.jpg', '0501-mr7pkqP.gif'),

  mk('3224', 'jack jump (male)', [], 'cardiovascular system',
    ["Stand with your feet together and your arms by your sides.", "Jump up, spreading your feet apart and raising your arms above your head.", "As you land, quickly jump back to the starting position.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds joints, bras le long du corps.", "Sautez en écartant les pieds et en levant les bras au-dessus de la tête.", "En atterrissant, sautez rapidement pour revenir à la position de départ.", "Répétez pour le nombre de répétitions souhaité."],
    '3224-1g5bPpA.jpg', '3224-1g5bPpA.gif'),

  mk('3638', 'push to run', [], 'cardiovascular system',
    ["Start in a push-up position with your hands shoulder-width apart and your body in a straight line.", "Lower your chest towards the ground by bending your elbows, keeping your body straight.", "Push through your hands to extend your arms and return to the starting position.", "Quickly bring one knee towards your chest, then quickly switch and bring the other knee towards your chest.", "Continue alternating knees as fast as you can while maintaining good form.", "Continue for the desired duration or number of repetitions."],
    ["Placez-vous en position de pompe, mains écartées à la largeur des épaules, corps aligné.", "Abaissez la poitrine vers le sol en fléchissant les coudes, corps gainé.", "Poussez sur les mains pour tendre les bras et revenir à la position de départ.", "Ramenez rapidement un genou vers la poitrine, puis changez rapidement de jambe.", "Continuez à alterner les genoux le plus vite possible en gardant une bonne forme.", "Continuez pour la durée ou le nombre de répétitions souhaité."],
    '3638-PrQbjvB.jpg', '3638-PrQbjvB.gif'),

  mk('0685', 'run', [], 'cardiovascular system',
    ["Start by standing upright with your feet hip-width apart.", "Engage your core and keep your upper body relaxed.", "Begin jogging in place, lifting your knees up towards your chest and landing softly on the balls of your feet.", "Maintain a steady pace and continue jogging for the desired duration or distance.", "Remember to breathe deeply and maintain good posture throughout the exercise."],
    ["Tenez-vous debout, pieds écartés à la largeur des hanches.", "Gainez le tronc et gardez le haut du corps relâché.", "Commencez à courir sur place, en montant les genoux vers la poitrine et en atterrissant en douceur sur l'avant du pied.", "Maintenez un rythme régulier et continuez pour la durée ou la distance souhaitée.", "Respirez profondément et gardez une bonne posture pendant tout l'exercice."],
    '0685-oLrKqDH.jpg', '0685-oLrKqDH.gif'),

  mk('0684', 'run (equipment)', [], 'cardiovascular system',
    ["Start by standing upright with your feet hip-width apart.", "Engage your core and keep your upper body relaxed.", "Begin jogging in place, lifting your knees up towards your chest and landing softly on the balls of your feet.", "Maintain a steady pace and continue jogging for the desired duration or distance.", "Remember to breathe deeply and maintain good posture throughout the exercise."],
    ["Tenez-vous debout, pieds écartés à la largeur des hanches.", "Gainez le tronc et gardez le haut du corps relâché.", "Commencez à courir sur place, en montant les genoux vers la poitrine et en atterrissant en douceur sur l'avant du pied.", "Maintenez un rythme régulier et continuez pour la durée ou la distance souhaitée.", "Respirez profondément et gardez une bonne posture pendant tout l'exercice."],
    '0684-y5p0H8a.jpg', '0684-y5p0H8a.gif'),

  mk('3219', 'scissor jumps (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Jump off the ground and simultaneously cross your right leg in front of your left leg.", "As you land, quickly switch legs, crossing your left leg in front of your right leg.", "Continue alternating legs and jumping as quickly as possible.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Sautez en croisant simultanément la jambe droite devant la jambe gauche.", "En atterrissant, changez rapidement de jambe en croisant la gauche devant la droite.", "Continuez à alterner les jambes en sautant le plus vite possible.", "Répétez pour le nombre de répétitions souhaité."],
    '3219-Eh2v5Iu.jpg', '3219-Eh2v5Iu.gif'),

  mk('3222', 'semi squat jump (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees and lower your body into a squat position.", "Jump explosively, extending your hips and knees while swinging your arms for momentum.", "Land softly on the balls of your feet and immediately go into the next repetition.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez les genoux et abaissez le corps en position de squat.", "Sautez explosivement en tendant hanches et genoux, en balançant les bras pour l'élan.", "Atterrissez en douceur sur l'avant des pieds et enchaînez directement la répétition suivante.", "Répétez pour le nombre de répétitions souhaité."],
    '3222-6FMU51h.jpg', '3222-6FMU51h.gif'),

  mk('3656', 'short stride run', [], 'cardiovascular system',
    ["Find an open space or a treadmill to perform the exercise.", "Stand tall with your feet hip-width apart.", "Start jogging in place, lifting your knees high and pumping your arms.", "After a few seconds, start taking short strides forward, maintaining a quick pace.", "Continue running with short strides for the desired duration or distance."],
    ["Trouvez un espace dégagé ou un tapis de course pour l'exercice.", "Tenez-vous droit, pieds écartés à la largeur des hanches.", "Commencez à courir sur place en montant bien les genoux et en balançant les bras.", "Après quelques secondes, commencez à avancer à petites foulées rapides.", "Continuez à courir à petites foulées pour la durée ou la distance souhaitée."],
    '3656-CcWEoWV.jpg', '3656-CcWEoWV.gif'),

  mk('3361', 'skater hops', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees slightly and jump to the right, landing on your right foot.", "As you land, swing your left leg behind your right leg and tap the ground with your left toes.", "Immediately jump to the left, landing on your left foot.", "As you land, swing your right leg behind your left leg and tap the ground with your right toes.", "Continue alternating sides, jumping and tapping the ground with each leg.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez légèrement les genoux et sautez vers la droite en atterrissant sur le pied droit.", "En atterrissant, balancez la jambe gauche derrière la droite et touchez le sol avec les orteils gauches.", "Sautez immédiatement vers la gauche en atterrissant sur le pied gauche.", "En atterrissant, balancez la jambe droite derrière la gauche et touchez le sol avec les orteils droits.", "Continuez à alterner les côtés, en sautant et en touchant le sol à chaque jambe.", "Répétez pour le nombre de répétitions souhaité."],
    '3361-zfNHMN9.jpg', '3361-zfNHMN9.gif'),

  mk('3671', 'ski step', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees slightly and keep your back straight.", "Jump to the right, landing on your right foot while swinging your left leg behind your right leg.", "Immediately jump to the left, landing on your left foot while swinging your right leg behind your left leg.", "Continue alternating jumps from side to side, mimicking a skiing motion.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez légèrement les genoux et gardez le dos droit.", "Sautez vers la droite en atterrissant sur le pied droit tout en balançant la jambe gauche derrière la droite.", "Sautez immédiatement vers la gauche en atterrissant sur le pied gauche tout en balançant la jambe droite derrière la gauche.", "Continuez à alterner les sauts d'un côté à l'autre, en imitant un mouvement de ski.", "Répétez pour le nombre de répétitions souhaité."],
    '3671-5MRH8H2.jpg', '3671-5MRH8H2.gif'),

  mk('3223', 'star jump (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart and your arms by your sides.", "Bend your knees slightly and jump up explosively.", "As you jump, spread your legs and extend your arms out to the sides, forming a star shape with your body.", "Land softly on the balls of your feet with your knees slightly bent.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules, bras le long du corps.", "Fléchissez légèrement les genoux et sautez explosivement vers le haut.", "En sautant, écartez les jambes et étendez les bras sur les côtés pour former une étoile.", "Atterrissez en douceur sur l'avant des pieds, genoux légèrement fléchis.", "Répétez pour le nombre de répétitions souhaité."],
    '3223-HtfCpfi.jpg', '3223-HtfCpfi.gif'),

  mk('2138', 'stationary bike run v. 3', ['stationary bike'], 'cardiovascular system',
    ["Adjust the seat height and position to ensure proper alignment.", "Place your feet on the pedals and secure them with the straps if available.", "Start pedaling at a comfortable pace.", "Maintain a steady rhythm and increase the resistance as desired.", "Engage your core muscles to maintain stability and proper posture.", "Continue pedaling for the desired duration of your workout.", "Gradually decrease the resistance and slow down before coming to a complete stop.", "Stretch your legs and cool down after the workout."],
    ["Réglez la hauteur et la position de la selle pour un bon alignement.", "Placez vos pieds sur les pédales et fixez-les avec les sangles si disponibles.", "Commencez à pédaler à un rythme confortable.", "Maintenez un rythme régulier et augmentez la résistance si souhaité.", "Gainez le tronc pour maintenir la stabilité et une bonne posture.", "Continuez à pédaler pendant la durée souhaitée de votre séance.", "Réduisez progressivement la résistance et ralentissez avant de vous arrêter complètement.", "Étirez vos jambes et récupérez après la séance."],
    '2138-H1PESYI.jpg', '2138-H1PESYI.gif'),

  mk('0798', 'stationary bike walk', ['leverage machine'], 'cardiovascular system',
    ["Adjust the seat height and position on the stationary bike to ensure proper alignment.", "Place your feet on the pedals and secure them with the straps if available.", "Start pedaling at a comfortable pace, keeping your back straight and core engaged.", "Maintain a steady rhythm and increase the resistance level if desired.", "Continue pedaling for the desired duration of your cardio workout.", "Cool down by gradually reducing your pace and resistance level.", "Stretch your leg muscles after the workout to prevent tightness and promote recovery."],
    ["Réglez la hauteur et la position de la selle du vélo stationnaire pour un bon alignement.", "Placez vos pieds sur les pédales et fixez-les avec les sangles si disponibles.", "Commencez à pédaler à un rythme confortable, dos droit et tronc gainé.", "Maintenez un rythme régulier et augmentez le niveau de résistance si souhaité.", "Continuez à pédaler pendant la durée souhaitée de votre séance cardio.", "Récupérez en réduisant progressivement le rythme et la résistance.", "Étirez les muscles des jambes après la séance pour éviter les raideurs et favoriser la récupération."],
    '0798-a8VDgLw.jpg', '0798-a8VDgLw.gif'),

  mk('3318', 'swing 360', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart and knees slightly bent.", "Hold your arms straight out in front of you, parallel to the ground.", "Engage your core and swing your arms in a circular motion, rotating your torso as you do so.", "Continue the circular motion, swinging your arms and rotating your torso for the desired number of repetitions.", "Remember to breathe throughout the exercise."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules, genoux légèrement fléchis.", "Tendez les bras devant vous, parallèles au sol.", "Gainez le tronc et faites tourner les bras en cercle, en faisant pivoter le torse.", "Continuez le mouvement circulaire, bras et torse, pour le nombre de répétitions souhaité.", "Pensez à respirer pendant tout l'exercice."],
    '3318-tnaj0mT.jpg', '3318-tnaj0mT.gif'),

  mk('2141', 'walk elliptical cross trainer', ['elliptical machine'], 'cardiovascular system',
    ["Adjust the resistance level and incline of the elliptical machine to your desired settings.", "Step onto the pedals of the machine and grip the handles lightly.", "Begin by pushing down with your feet and pulling the handles towards your body.", "Continue this motion, alternating between pushing and pulling, to simulate a walking or running motion.", "Maintain a steady pace and keep your core engaged throughout the exercise.", "Continue for the desired duration of your cardio workout.", "Gradually decrease the intensity and speed of the machine before stepping off."],
    ["Réglez le niveau de résistance et l'inclinaison du vélo elliptique selon vos préférences.", "Montez sur les pédales de l'appareil et saisissez légèrement les poignées.", "Commencez par pousser avec les pieds et tirer les poignées vers vous.", "Continuez ce mouvement, en alternant poussée et traction, pour simuler la marche ou la course.", "Maintenez un rythme régulier et gardez le tronc gainé pendant tout l'exercice.", "Continuez pour la durée souhaitée de votre séance cardio.", "Diminuez progressivement l'intensité et la vitesse de l'appareil avant de descendre."],
    '2141-rjtuP6X.jpg', '2141-rjtuP6X.gif'),

  mk('3655', 'walking high knees lunge', [], 'cardiovascular system',
    ["Stand with your feet hip-width apart.", "Lift your right knee up towards your chest as high as you can while balancing on your left leg.", "Step forward with your right foot and lower your body into a lunge position, bending both knees to a 90-degree angle.", "Push off with your right foot and bring your left knee up towards your chest.", "Step forward with your left foot and lower your body into a lunge position.", "Continue alternating legs and lunging forward, keeping your core engaged and maintaining a steady pace.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des hanches.", "Levez le genou droit vers la poitrine le plus haut possible en gardant l'équilibre sur la jambe gauche.", "Avancez le pied droit et descendez en fente, en fléchissant les deux genoux à 90 degrés.", "Repoussez avec le pied droit et levez le genou gauche vers la poitrine.", "Avancez le pied gauche et descendez en fente.", "Continuez à alterner les jambes en avançant, tronc gainé et rythme régulier.", "Répétez pour le nombre de répétitions souhaité."],
    '3655-J9zIWig.jpg', '3655-J9zIWig.gif'),

  mk('3666', 'walking on incline treadmill', ['leverage machine'], 'cardiovascular system',
    ["Adjust the incline level on the treadmill to your desired intensity.", "Stand on the treadmill with your feet shoulder-width apart.", "Start walking at a comfortable pace, ensuring that you maintain proper form.", "Engage your core muscles and keep your back straight throughout the exercise.", "Continue walking on the incline treadmill for the desired duration of your cardio workout.", "Gradually decrease the incline and speed of the treadmill to cool down before stopping."],
    ["Réglez le niveau d'inclinaison du tapis de course selon l'intensité souhaitée.", "Tenez-vous sur le tapis, pieds écartés à la largeur des épaules.", "Commencez à marcher à un rythme confortable en veillant à garder une bonne posture.", "Gainez le tronc et gardez le dos droit pendant tout l'exercice.", "Continuez à marcher sur le tapis incliné pendant la durée souhaitée de votre séance cardio.", "Réduisez progressivement l'inclinaison et la vitesse du tapis pour récupérer avant de vous arrêter."],
    '3666-rjiM4L3.jpg', '3666-rjiM4L3.gif'),

  mk('2311', 'walking on stepmill', ['stepmill machine'], 'cardiovascular system',
    ["Adjust the stepmill machine to a comfortable level.", "Step onto the machine and place your hands on the handrails for support.", "Start walking by placing one foot on a step and then the other, alternating between legs.", "Maintain an upright posture and engage your core muscles.", "Continue walking for the desired duration or distance.", "Gradually increase the intensity or speed as you become more comfortable with the exercise.", "Remember to cool down and stretch after completing the exercise."],
    ["Réglez le stepmill à un niveau confortable.", "Montez sur l'appareil et posez les mains sur les rampes pour vous soutenir.", "Commencez à marcher en posant un pied sur une marche puis l'autre, en alternant les jambes.", "Gardez une posture droite et le tronc gainé.", "Continuez à marcher pour la durée ou la distance souhaitée.", "Augmentez progressivement l'intensité ou la vitesse à mesure que vous êtes plus à l'aise.", "Pensez à récupérer et à vous étirer après l'exercice."],
    '2311-j9Q5crt.jpg', '2311-j9Q5crt.gif'),

  mk('3637', 'wheel run', [], 'cardiovascular system',
    ["Start in a plank position with your hands on the wheel and your body straight.", "Engage your core and start rolling the wheel forward by extending your arms.", "Continue rolling until your body is fully extended and your arms are overhead.", "Reverse the movement by pulling the wheel back towards your body, using your core and arms.", "Repeat for the desired number of repetitions."],
    ["Placez-vous en position de planche, mains sur la roue, corps aligné.", "Gainez le tronc et commencez à faire rouler la roue vers l'avant en tendant les bras.", "Continuez à rouler jusqu'à ce que le corps soit complètement tendu, bras au-dessus de la tête.", "Inversez le mouvement en ramenant la roue vers vous, en utilisant le tronc et les bras.", "Répétez pour le nombre de répétitions souhaité."],
    '3637-km2Ljzj.jpg', '3637-km2Ljzj.gif'),
]
