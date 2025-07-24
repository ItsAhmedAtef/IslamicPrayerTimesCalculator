// المرجع الأساسي: https://astronomycenter.net/article/2001_salat.html

class CalculateIslamicPrayerTimes {

    constructor(options) {
        const defaultOptions = {
            longitude: null,
            latitude: null,
            timeZone: null,
            mazhab: 'shafi',
            fajrAngle: 18,
            ishaaAngleOrMin: 18,
            date: new Date(),
            isDaylightSavingTime: false,
            is24HourFormat: false,
            refraction: 0.569333, // Advanced
            dipOfHorizon: 0       // Advanced
        };
        const config = { ...defaultOptions, ...options };

        if (typeof config.longitude !== 'number' || config.longitude < -180 || config.longitude > 180) {
            throw new Error('يجب أن تكون قيمة خط الطول رقم بين -180 و 180.');
        };
        this.longitude = config.longitude;

        if (typeof config.latitude !== 'number' || config.latitude < -90 || config.latitude > 90) {
            throw new Error('يجب أن تكون قيمة خط العرض رقم بين -90 و 90.');
        };
        this.latitude = config.latitude;

        if (typeof config.timeZone !== 'number' || config.timeZone < -12 || config.timeZone > 14 || !Number.isInteger(config.timeZone)) {
            throw new Error('المنطقة الزمنية يجب أن تكون رقم صحيح بين -12 و 14.');
        };
        this.timeZone = config.timeZone;

        if (config.mazhab !== 'shafi' && config.mazhab !== 'hanafi') {
            throw new Error('اختر المذهب إما "shafi" أو "hanafi".');
        };
        // shafi: شافعي، حنبلي، مالكي
        // hanafi: حنفي
        this.mazhab = config.mazhab;

        this.isDaylightSavingTime = Boolean(config.isDaylightSavingTime); // التوقيت الصيفي مُفعل؟
        this.is24HourFormat = Boolean(config.is24HourFormat); // "04:30 AM" | "16:30"

        if (typeof config.refraction !== 'number' || config.refraction <= 0 || config.refraction > 1.0) {
            throw new Error('الانكسار يجب أن يكون رقم موجب، غالباً يقع بين 0.5 و 0.7 درجة.');
        }
        this.refraction = config.refraction;

        if (typeof config.dipOfHorizon !== 'number' || config.dipOfHorizon < 0 || config.dipOfHorizon > 3) {
            throw new Error('انخفاض الأفق يجب أن يكون رقم مابين 0 و 3 درجة.');
        }
        this.dipOfHorizon = config.dipOfHorizon;

        // "يبدأ وقت صلاة الفجر عند انتشار الضوء الأبيض في جهة الشرق بعد ظهور الفجر الكاذب"
        // "الفجر الصادق يبدأ بالظهور عندما يكون مركز الشمس منخفضا تحت الأفق بمقدار 18 درجة"
        // "في مصر على سبيل المثال فهم يعتمدون الزاوية 19.5 للفجر"
        if (typeof config.fajrAngle !== 'number' || config.fajrAngle < 10 || config.fajrAngle > 25) {
            throw new Error('زاوية الفجر يجب أن تكون رقم بين 10 و 25.');
        };
        this.fajrAngle = config.fajrAngle;

        // "الزاوية الإفتراضية هي 18"
        // "في مصر على سبيل المثال فهم يعتمدون الزاوية 17.5 للعشاء"
        if (typeof config.ishaaAngleOrMin !== 'number' || config.ishaaAngleOrMin < 10 || config.ishaaAngleOrMin > 25) {
            if ( config.ishaaAngleOrMin !== 90 && config.ishaaAngleOrMin !== 120 ) {
                throw new Error('زاوية العشاء تتراوح بين 10 و 25 درجة، أو يُمكن أن تكون 90 أو 120 دقيقة وفقاً لطريقة حساب (أم القرى).');
            };
        };
        this.ishaaAngleOrMin = config.ishaaAngleOrMin;

        if (!(config.date instanceof Date) || isNaN(config.date.getTime())) {
            throw new Error('يجب أن يكون التاريخ صالحاً.');
        };
        this.date = config.date;
        this.julianDay = this.calculateJulianDayWithTime(
            this.date.getUTCFullYear(),
            this.date.getUTCMonth()+1,
            this.date.getUTCDate(),
            this.date.getUTCHours(),
            this.date.getUTCMinutes(),
            this.date.getUTCSeconds()
        );

        this.solarData = this.calculateSolarData();

        let warningMessage = '⚠️️ تحذير هام ️️⚠️️';
        warningMessage    += '\nتم الاستعانة بمعادلة حسابية فلكية وبقيم تقديرية وسطية؛ نظراً لعدم إمكانية توفير متغيرات دقيقة ديناميكياً';
        warningMessage    += ' مثل قيم (انكسار أشعة الشمس، الضغط الجوي بالملبار، ...)، ونظراً لاحتمالية وقوع نسبة خطأ مهما كانت صغيرة';
        warningMessage    += '، أو بسبب الاختلافات البسيطة في الإحداثيات داخل المدينة الواحدة؛ لذلك لا يُنصح بالاعتماد الكامل على هذه المعادلة';
        warningMessage    += ' بنسبة 100% للإفطار أو الإمساك أو في كافة الصلوات دون الرجوع إلى تقويم رسمي مُعتمد في بلدك.';
        console.warn(warningMessage);
    };

    degToRad(degrees) {
        return degrees * Math.PI / 180;
    };

    radToDeg(radians) {
        return radians * 180 / Math.PI;
    };

    normalizeAngle(angle) {
        let normalized = angle % 360;
        if (normalized < 0) normalized += 360; // إذا كان الناتج سالباً، نضيف 360 لجعله موجباً

        return normalized;
    };

    formatTime(decimalTime) {
        let hours = Math.floor(decimalTime);
        let minutes = Math.floor((decimalTime - hours) * 60);

        if (this.isDaylightSavingTime) hours += 1;
        hours = (hours % 24 + 24) % 24;

        if (this.is24HourFormat) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        };

        // تنسيق 12 ساعة
        const suffix = hours >= 12 ? 'PM': 'AM';
        let displayHours = hours % 12;
        if (displayHours === 0) displayHours = 12;

        return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${suffix}`;
    };

    calculateJulianDayWithTime(year, month, day, hour = 0, minute = 0, second = 0) {
        // حساب اليوم اليولياني

        // الجزء الكسري من اليوم
        const dayFraction = (hour + minute / 60 + second / 3600) / 24;

        // إذا كان الشهر يناير أو فبراير، نعدّل السنة والشهر
        if (month <= 2) {
            year -= 1;
            month += 12;
        };

        const A = Math.floor(year / 100);
        let B;

        if (year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)))) {
            // إذا كان التاريخ بالتقويم الجريجوري (ابتداء من 15/10/1582 م)
            B = 2 - A + Math.floor(A / 4);
        } else {
            B = 0; // التاريخ بالتقويم اليولياني
        };

        const JD = Math.floor(365.25 * (year + 4716)) +
                   Math.floor(30.6001 * (month + 1)) +
                   day + dayFraction + B - 1524.5;

        return JD;
    };

    calculateSolarData() {
        // حساب إحداثيات الشمس و معادلة الزمن
        // "معادلة الزمن هي الوقت اللازم للشمس الحقيقية حتى تصل إلى موقع الشمس المتوسطة
        // أو العكس تبعا للتعريف المعتمد لمعادلة الزمن"

        // "تبلغ دقة هذه المعادلات في الفترة ما بين 1950م و حتى 2050م 0.01 درجة
        // بالنسبة للإحداثيات الإستوائية للشمس و 0.1 دقيقة بالنسبة لمعادلة الزمن"

        const n = this.julianDay - 2451545.0; // عدد الأيام منذ التاريخ المعطى
        const L = this.normalizeAngle(280.466 + 0.9856474 * n); // خط طول الشمس الوسطي المصحح للزيغان بالدرجات
        const g = this.normalizeAngle(357.528 + 0.9856003 * n); // البعد الزاوي الوسطي للشمس عن نقطة الحضيض بالدرجات

        // خط الطول البرجي للشمس بالدرجات
        // λ = L + º1.915 sin g + º0.020 sin 2g
        const eclipticLongitude = L +
                                1.915 * Math.sin(this.degToRad(g)) +
                                0.020 * Math.sin(this.degToRad(2 * g));

        // ميلان محور الأرض بالدرجات
        // ε = º23.440 – º0.0000004 * n
        const obliquityOfEcliptic = 23.440 - 0.0000004 * n;

        // الصعود المستقيم للشمس بالدرجات
        // α = tan-1 ( cos ε tan λ )
        const rightAscensionRad = Math.atan2(
            Math.cos(this.degToRad(obliquityOfEcliptic)) * Math.sin(this.degToRad(eclipticLongitude)),
            Math.cos(this.degToRad(eclipticLongitude))
        );
        // تحويل من راديان إلى درجات
        const rightAscension = this.normalizeAngle(this.radToDeg(rightAscensionRad));

        // الميل الإستوائي للشمس بالدرجات
        // δ = sin-1 ( sin ε sin λ )
        const declinationRad = Math.asin(
            Math.sin(this.degToRad(obliquityOfEcliptic)) * Math.sin(this.degToRad(eclipticLongitude))
        );
        const declination = this.radToDeg(declinationRad);

        // معادلة الزمن بالدقائق (الوقت الشمسي الحقيقي - الوقت الشمسي المتوسط)
        // E = ( L – α ) * 4
        let equationOfTimeMinutes = (L - rightAscension);
        equationOfTimeMinutes = this.normalizeAngle(equationOfTimeMinutes + 180) - 180;
        equationOfTimeMinutes *= 4;
        const E = equationOfTimeMinutes / 60; // بالساعات

        // بُعد الأرض عن الشمس بالوحدات الفلكية
        // R = 1.00014 – 0.01671 cos g – 0.00014 cos 2g
        const R = 1.00014 - 0.01671 * Math.cos(this.degToRad(g)) - 0.00014 * Math.cos(this.degToRad(2 * g));

        // اللوص الأفقي بالدرجات
        const horizontalParallax = 0.0024;

        // نصف قطر الشمس الظاهري بالدرجات
        const semiDiameter = 0.2666 / R;

        return {
            eclipticLongitude,
            obliquityOfEcliptic,
            rightAscension,
            declination,
            E,
            R,
            horizontalParallax,
            semiDiameter
        };
    };

    /**
     * @function prayerTimeEquation
     * @param {number} zenithAngle - زاوية سمت الرأس للشمس المرتبطة بالصلاة المحددة
     * @param {boolean} isBeforeNoon - قبل وقت الظهر ام بعده؟
     * @param {boolean} formatTime - تحويل الوقت من عشري إلى ساعات ودقائق؟
     * @returns {string} - (ex: "04:30 AM", "16:30") | وقت عشري
     */
    prayerTimeEquation(zenithAngle, isBeforeNoon, formatTime = true) {
        // θ (zenithAngle): زاوية سمت الرأس
        // Φ: خط العرض الجغرافي للموقع
        // δ: الميل الإستوائي للشمس
        // H: "الزاويه الساعية وهي الزاوية المراد إيجادها، و تحول إلى زمن بالقسمة على 15
        //    ومن ثم نطرح هذا الزمن من وقت صلاة الظهر لإيجاد وقت صلاة الفجر أو شروق الشمس
        //    أو يضاف هذا الزمن إلى وقت صلاة الظهر لإيجاد وقت صلاة العصر أو المغرب أوالعشاء"

        // المعادلة
        //          ( cos(θ) - sin(Φ) sin(δ) )
        // cos(H) = __________________________
        //                 cos(Φ) cos(δ)

        const x = Math.cos(this.degToRad(zenithAngle)) -
                ( Math.sin(this.degToRad(this.latitude)) * Math.sin(this.degToRad(this.solarData.declination)) );
        const y = Math.cos(this.degToRad(this.latitude)) * Math.cos(this.degToRad(this.solarData.declination));

        let cosH = x / y;

        // ضمان أن القيمة ضمن النطاق [-1, 1] لتجنب الأخطاء العددية
        // بسبب دقة الفواصل العائمة، قد تكون القيمة قريبة جداً من 1 أو -1
        // (مثلاً 1.0000000000000001 أو -1.0000000000000001)
        if (cosH > 1)  cosH =  1;
        if (cosH < -1) cosH = -1;

        // حساب الزاوية الساعية
        const hourAngleRad = Math.acos(cosH);
        const hourAngleDegrees = this.radToDeg(hourAngleRad); // بالدرجات

        let longitudeCorrection = ( (this.timeZone*15) - this.longitude) / 15;

        let prayerTime;
        if (isBeforeNoon) { // الفجر والشروق
            prayerTime = 12 - (hourAngleDegrees / 15) + longitudeCorrection - this.solarData.E;
        } else { // العصر، المغرب، العشاء
            prayerTime = 12 + (hourAngleDegrees / 15) + longitudeCorrection - this.solarData.E;
        };

        if ( formatTime ) return this.formatTime(prayerTime);
        return prayerTime; // عشري
    };

    calculateFajrPrayerTime() {
        // زاوية سمت الرأس لصلاة الفجر
        // "وحيث إن الأفق يبعد عن وسط السماء بمقدار 90 درجة"
        const zenithAngle = 90 + this.fajrAngle;
        return this.prayerTimeEquation(zenithAngle, true);
    };

    calculateShuruqPrayerTime() {
        // (زاوية سمت الرأس (الشروق
        const zenithAngle = 90 + this.solarData.semiDiameter + this.refraction + this.dipOfHorizon - this.solarData.horizontalParallax;
        return this.prayerTimeEquation(zenithAngle, true);
    };

    calculateZuhrPrayerTime() {
        // "يتم حساب موعد صلاة الظهر مباشرة باستخدام المعادلة
        // يبدأ وقت صلاة الظهر عند زوال الشمس، أي ميلها عن سط السماء
        // ولا يقصد بوسط السماء نقطة سمت الرأس (وهي النقطة الواقعة فوق رأس الراصد مباشرة في السماء)
        // بل المقصود هو خط الزوال، وهو الخط الواقع في منتصف المسافة بين المشرق و المغرب
        // و يمر هذا الخط  في جهتي الشمال و الجنوب تماماً
        // فما أن يصل مركز قرص الشمس إلى خط الزوال حتى يحين موعد صلاة الظهر"

        // (فرق خط الطول): "قسمت الكرة الأرضية إلى حزم زمنية، عرض الواحد منها 15 درجة
        //                  ولكل حزمة زمنية خط طول يسمى خط الطول الأوسط"
        // فرق خط الطول = (خط الطول الأوسط - خط طول الموقع) /  15
        const longitudeCorrection = ( (this.timeZone*15) - this.longitude) / 15;

        // وقت الظهر = 12 + فرق خط الطول (بالساعات) - معادلة الزمن (بالساعات)
        const zuhrTime = 12 + longitudeCorrection - this.solarData.E;
        return this.formatTime(zuhrTime);
    };

    calculateAsrPrayerTime() {
        // "يبدأ وقت صلاة العصر حسب المذهب الشافعي عندما يصبح طول ظل الشاخص
        // يساوي طول الشاخص نفسه مضافا إليه ظل الشاخص وقت الزوال (الظهر)"

        // "أما حسب المذهب الحنفي يبدأ وقت صلاة العصر عندما يصبح طول ظل الشاخص
        // يساوي مثلي طول الشاخص نفسه مضافا إليه ظل الشاخص وقت الزوال"

        // علما بأن معظم الدول الإسلاميه تعتمد تعريف المذهب الشافعي

        // Φ: خط العرض الجغرافي للموقع
        // δ: الميل الإستوائي للشمس
        // a  = sin-1 (sin(Φ) sin (δ) + cos (Φ) cos (δ) )
        const a = Math.asin(
            Math.sin(this.degToRad(this.latitude)) * Math.sin(this.degToRad(this.solarData.declination)) +
            Math.cos(this.degToRad(this.latitude)) * Math.cos(this.degToRad(this.solarData.declination))
        );

        const cotA = 1 / Math.tan(a);

        let thetaPrime; // θ' زاوية سمت الرأس الأولية
        if (this.mazhab === 'shafi') {
            // θ’ = 90 – cot-1 (1 + cot (a) )  ... (5)
            // cot-1(x) = atan(1/x)
            thetaPrime = 90 - this.radToDeg(Math.atan(1 / (1 + cotA)));
        } else {
            // hanafi
            // θ’ = 90 – cot-1 (2 + cot (a) )  ... (6)
            thetaPrime = 90 - this.radToDeg(Math.atan(1 / (2 + cotA)));
        };

        // ⚠️ لا نضيف أي انكسار
        return this.prayerTimeEquation(thetaPrime, false);

        // حساب قيمة الانكسار الأولية
        // R' = 1 / tan(h + (7.31 / (h + 4.4)))
        // h: بعد مركز الشمس عن الأفق بالدرجات
        const h = 90 - thetaPrime;
        const rPrime = 1 / Math.tan( this.degToRad(
            h + (7.31 / (h + 4.4))
        ));

        const atmosphericPressure = 1010; // الضغط الجوي: 1010 مليبار (قيمة قياسية شائعة)
        const temperatureCelsius = 15; // درجة الحرارة: 15 درجة مئوية (قيمة مرجعية قياسية للنماذج الجوية الفلكية)

        // حساب قيمة الانكسار النهائية
        // R = R' * (0.28 * P) / (T + 273)
        const rFinal = rPrime * (0.28 * atmosphericPressure / (temperatureCelsius + 273));
        const finalZenithAngle = thetaPrime + rFinal;
        return this.prayerTimeEquation(finalZenithAngle, false);
    };

    calculateMaghribPrayerTime( formatTime = true ) {
        // "يبدأ وقت صلاة المغرب عند غروب الحافة العليا لقرص الشمس تحت الأفق الغربي"

        // زاوية سمت الرأس لصلاة المغرب
        // 90º + نصف قطر الشمس الظاهري + الانكسار + انخفاض الأفق - اللوص الأفقي
        const zenithAngle = 90 + this.solarData.semiDiameter + this.refraction + this.dipOfHorizon - this.solarData.horizontalParallax;
        return this.prayerTimeEquation(zenithAngle, false, formatTime);
    };

    calculateIshaaPrayerTime() {
        // "يبدأ وقت صلاة العشاء عند اختفاء الضوء الأبيض من جهة الغرب بعد غروب الشمس و دخول ظلمة الليل"

        // زاوية سمت الرأس لصلاة العشاء
        // "وحيث إن الأفق يبعد عن وسط السماء بمقدار 90 درجة"
        let zenithAngle;
        if ( this.ishaaAngleOrMin === 90 || this.ishaaAngleOrMin === 120 ) {
            // 90 | 120 دقيقة
            // (أم القرى): إضافة 120 دقيقة أو 90 دقيقة على وقت المغرب
            return this.formatTime(
                this.calculateMaghribPrayerTime(false) + ( this.ishaaAngleOrMin / 60 )
            );
        } else {
            // زاوية العشاء
            zenithAngle = 90 + this.ishaaAngleOrMin;
        };

        return this.prayerTimeEquation(zenithAngle, false);
    };

    getPrayerTimeDate() {
        return this.date;
    };

}
