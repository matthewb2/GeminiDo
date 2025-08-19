// Prism 언어 컴포넌트 로드 함수
(function loadPrismLanguages() {
    const langs = [
        './components/prism-java.min.js',
        './components/prism-python.min.js',
        './components/prism-c.min.js'
    ];

    langs.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.defer = true; // 로딩 순서 보장
        document.head.appendChild(script);
    });
})();
