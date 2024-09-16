import React from 'react'
import Svg, {Path} from 'react-native-svg'

export function TwentyFivePercent({fill}: {fill?: string}) {
  return (
    <Svg fill="none" viewBox="0 0 101 101">
      <Path
        fill={fill}
        fillRule="evenodd"
        clipRule="evenodd"
        d="m63.145 6.112-3.002-.49c.02-.252 0-.487-.06-.704a1.548 1.548 0 0 0-.287-.583 1.576 1.576 0 0 0-.514-.433 2.24 2.24 0 0 0-.74-.247c-.498-.081-.938-.03-1.321.156-.38.185-.696.489-.947.91-.247.423-.422.95-.526 1.581-.109.667-.111 1.24-.008 1.72.108.477.314.856.617 1.139.305.28.696.458 1.175.536a2.5 2.5 0 0 0 .751.019c.228-.036.433-.106.614-.211.18-.105.336-.242.466-.41.133-.172.237-.371.31-.6l2.999.512c-.111.455-.317.904-.62 1.347-.3.439-.69.827-1.167 1.164a4.665 4.665 0 0 1-1.675.72c-.644.147-1.364.155-2.163.024-1-.163-1.863-.524-2.587-1.084-.721-.558-1.244-1.292-1.57-2.201-.32-.909-.383-1.966-.186-3.172.199-1.214.6-2.197 1.204-2.95.604-.758 1.339-1.285 2.203-1.58.865-.3 1.787-.37 2.766-.21.688.113 1.306.31 1.854.593a4.63 4.63 0 0 1 1.387 1.073c.378.43.657.93.837 1.498.18.568.244 1.196.19 1.883Zm1.052 7.644 4.921-9.887 7.126 3.546-1.077 2.163-4.441-2.21-.846 1.699 4.075 2.028-1.077 2.162-4.074-2.027-.846 1.699 4.422 2.2-1.076 2.163-7.107-3.536Zm16.824-3.2-7.456 8.146 2.211 2.024 2.462-2.689.765.7-1.03 3.999 2.402 2.199 1.125-4.552a3.216 3.216 0 0 0 1.786.045c.626-.162 1.207-.535 1.74-1.119.53-.578.858-1.189.984-1.833a3.35 3.35 0 0 0-.188-1.92c-.252-.634-.68-1.229-1.285-1.782l-3.516-3.219Zm-1.21 5.763.779.713c.26.238.51.41.752.513.246.103.484.129.713.075.232-.05.453-.192.664-.422.214-.234.337-.47.37-.707a1.145 1.145 0 0 0-.127-.716 2.473 2.473 0 0 0-.566-.716l-.78-.713-1.806 1.973Zm9.085 5.498 2.07-1.246 4.949 8.224-2.07 1.246-1.713-2.846-7.392 4.448-1.524-2.532 7.393-4.448-1.713-2.846Zm-1.004 17.267L98.34 35.51l-.97-2.837-10.45 3.575.97 2.837Zm.809 2.203 10.951-1.421 1 7.7-2.396.311-.614-4.727-1.882.244.552 4.257-2.395.31-.553-4.256-4.278.555-.385-2.973Zm.672 13.22 11.016.776.211-2.991-11.016-.776-.211 2.99Zm-.103 2.35 10.636 2.973-2.142 7.665-2.326-.65 1.335-4.778-1.828-.51-1.225 4.382-2.327-.65 1.225-4.383-1.828-.511-1.33 4.757-2.326-.65 2.136-7.645ZM86.221 67.06l-2.293 3.577c-.605.945-.945 1.882-1.02 2.811a4.626 4.626 0 0 0 .568 2.632c.454.824 1.165 1.547 2.133 2.168.969.62 1.922.962 2.86 1.025a4.568 4.568 0 0 0 2.633-.592c.819-.457 1.534-1.165 2.147-2.12l2.27-3.542-9.298-5.96Zm-.092 4.86.617-.963 5.012 3.213-.57.89c-.31.484-.646.845-1.008 1.083-.364.24-.782.331-1.256.27-.476-.056-1.038-.293-1.685-.708-.648-.415-1.098-.825-1.35-1.23-.255-.403-.352-.815-.29-1.237.058-.418.235-.858.53-1.318Zm-10.963 9.085 5.842 9.372-4.064 2.533c-.714.445-1.373.722-1.978.833-.608.112-1.145.07-1.61-.127-.47-.195-.852-.53-1.149-1.007a2.308 2.308 0 0 1-.359-1.085 2.381 2.381 0 0 1 .187-1.108 2.96 2.96 0 0 1 .707-.986l-.058-.092a2.77 2.77 0 0 1-1.289.378 2.48 2.48 0 0 1-1.27-.283c-.398-.205-.735-.528-1.01-.97a2.824 2.824 0 0 1-.45-1.62c.015-.565.198-1.115.546-1.65.349-.535.864-1.014 1.544-1.438l4.411-2.75Zm-1.278 3.618-1.19.741c-.427.266-.697.545-.812.837-.113.295-.071.6.124.914.137.22.304.374.5.464.195.09.41.116.646.08.233-.035.479-.133.738-.295l1.227-.764-1.233-1.977Zm2.214 3.55-1.044.651a1.819 1.819 0 0 0-.524.473c-.128.177-.197.36-.21.55a.954.954 0 0 0 .159.582c.18.29.422.446.724.47.305.025.616-.06.933-.258l1.08-.673-1.118-1.794Zm-7.713 9.13-3.068-10.61-7.17 2.073.672 2.32 4.29-1.24 2.395 8.289 2.88-.833Zm-19.526 3.041-2.998-.036.087-7.075c.01-.84.22-1.566.63-2.176.407-.606.97-1.072 1.69-1.398.72-.322 1.552-.477 2.497-.465.953.012 1.785.187 2.496.527.711.343 1.263.822 1.654 1.439.388.62.577 1.35.566 2.19l-.087 7.075-2.998-.037.084-6.816a1.843 1.843 0 0 0-.215-.919 1.634 1.634 0 0 0-.618-.633 1.843 1.843 0 0 0-.914-.238 1.824 1.824 0 0 0-.92.215 1.634 1.634 0 0 0-.632.618 1.844 1.844 0 0 0-.238.914l-.084 6.815Zm-9.547-1.102 3.408-10.505-7.55-2.45-.746 2.299 4.699 1.524-.586 1.806-4.329-1.405-.746 2.298 4.33 1.404-.586 1.806-4.72-1.531-.745 2.298 7.571 2.456ZM23.556 88.19c-.176.314-.222.622-.135.924.084.3.327.585.73.857.256.173.487.283.693.331.201.05.376.048.523-.004a.732.732 0 0 0 .363-.276.708.708 0 0 0 .144-.339.874.874 0 0 0-.064-.388 2.113 2.113 0 0 0-.262-.45 5.045 5.045 0 0 0-.46-.532l-.642-.668a6.812 6.812 0 0 1-1.014-1.303 3.736 3.736 0 0 1-.465-1.218c-.071-.39-.06-.77.032-1.137.089-.37.25-.73.482-1.08.41-.6.904-1.007 1.483-1.223.58-.216 1.22-.246 1.921-.089.698.155 1.434.494 2.209 1.017.796.537 1.41 1.123 1.844 1.76.431.633.645 1.305.643 2.014-.007.711-.268 1.45-.782 2.218l-2.36-1.593c.175-.29.264-.573.267-.848a1.41 1.41 0 0 0-.234-.79 2.495 2.495 0 0 0-.718-.7 2.35 2.35 0 0 0-.733-.35 1.085 1.085 0 0 0-.59-.003.777.777 0 0 0-.412.302.682.682 0 0 0-.109.46c.014.165.093.357.236.575.141.221.357.484.646.788l.779.812c.691.723 1.132 1.448 1.322 2.175.185.728.035 1.448-.45 2.162-.39.582-.888.986-1.495 1.21-.611.224-1.278.27-2 .139-.725-.134-1.45-.446-2.174-.935-.738-.499-1.294-1.054-1.666-1.665-.373-.612-.553-1.24-.54-1.888.006-.646.21-1.27.611-1.87l2.378 1.605Zm-8.537-2.512 8.56-6.978-1.895-2.324-2.206 1.8-1.63.048 1.642-4.54-2.262-2.775-2.336 6.83-6.17.216 2.208 2.708 5.56-.247.095.117-3.46 2.822 1.894 2.323Zm-8.685-11.74L5.09 70.836l3.36-3.673-.032-.08-4.967-.33-1.245-3.103 8.536.943 3.223-1.294 1.109 2.763-3.223 1.293-5.516 6.584ZM.652 52.448l11.032.49.353-7.93-2.414-.107-.219 4.934-1.896-.084.202-4.546-2.414-.108-.202 4.547-1.896-.084.22-4.956-2.413-.108-.353 7.952ZM12.458 42.42 1.936 39.065l.911-2.856 8.22 2.62 1.357-4.254 2.301.734-2.267 7.11Zm3.2-9.565 2.393-3.511c.632-.927.998-1.854 1.1-2.782a4.625 4.625 0 0 0-.494-2.646c-.43-.837-1.121-1.58-2.072-2.227-.95-.648-1.893-1.017-2.829-1.106a4.568 4.568 0 0 0-2.65.517c-.83.435-1.566 1.121-2.205 2.06l-2.37 3.476 9.127 6.219Zm.229-4.856-.644.945-4.92-3.353.596-.873c.324-.475.67-.827 1.038-1.054.37-.23.791-.31 1.263-.236.474.07 1.029.323 1.665.756.636.433 1.074.856 1.315 1.268.243.41.328.824.255 1.244-.071.417-.26.852-.568 1.303Zm7.155-5.173-6.926-8.602 6.2-4.991 1.515 1.881-3.865 3.112 1.19 1.478 3.546-2.854 1.515 1.882-3.545 2.854 1.19 1.478 3.848-3.097 1.514 1.882-6.182 4.977Zm4.141-16.635 4.275 10.183 2.765-1.161-1.411-3.361.956-.402 3.2 2.61 3.002-1.26L36.31 9.87c.421-.475.684-1.009.788-1.602.115-.637.02-1.32-.287-2.05-.303-.722-.721-1.276-1.253-1.66a3.351 3.351 0 0 0-1.822-.634c-.682-.037-1.4.103-2.157.42l-4.395 1.846Zm4.727 3.513-1.036-2.466.975-.41c.325-.136.62-.207.887-.214.268-.01.502.05.703.185.202.13.365.34.487.631.121.289.156.549.106.78-.048.231-.17.437-.367.617a2.755 2.755 0 0 1-.78.468l-.975.409Zm35.849 55.521v-1.027c0-.824.177-1.584.532-2.281a4.257 4.257 0 0 1 1.569-1.683c.684-.425 1.518-.637 2.5-.637 1.008 0 1.854.209 2.539.627.69.419 1.214.976 1.569 1.674.355.697.532 1.464.532 2.3v1.027c0 .824-.18 1.585-.542 2.282a4.17 4.17 0 0 1-1.569 1.683c-.69.424-1.533.637-2.529.637-.995 0-1.835-.213-2.52-.637a4.188 4.188 0 0 1-1.558-1.683 5.03 5.03 0 0 1-.523-2.282Zm3.308-1.027v1.027c0 .361.09.72.267 1.074.183.349.526.523 1.026.523.526 0 .872-.17 1.037-.513.17-.342.256-.704.256-1.084v-1.027c0-.38-.079-.748-.237-1.103-.159-.355-.51-.532-1.056-.532-.5 0-.843.177-1.026.532a2.437 2.437 0 0 0-.267 1.103Zm-13.5-10.116v-1.026c0-.837.18-1.604.542-2.301a4.259 4.259 0 0 1 1.578-1.674c.684-.418 1.512-.627 2.481-.627 1.008 0 1.854.21 2.539.627.69.419 1.214.976 1.569 1.674.355.697.532 1.464.532 2.3v1.027c0 .837-.18 1.6-.542 2.292a4.058 4.058 0 0 1-1.569 1.654c-.69.412-1.534.618-2.529.618-.995 0-1.835-.21-2.52-.628a4.14 4.14 0 0 1-1.558-1.663 4.972 4.972 0 0 1-.523-2.273Zm3.346-1.026v1.026c0 .38.09.742.267 1.084.177.342.507.514.988.514.526 0 .872-.172 1.037-.514.17-.342.256-.703.256-1.084v-1.026c0-.38-.079-.748-.237-1.103-.159-.355-.51-.533-1.056-.533-.5 0-.836.184-1.007.552a2.592 2.592 0 0 0-.248 1.084Zm-1.73 15.82L72.57 49.405h2.7L61.883 68.876h-2.7Zm-15.058-.523c1.16.526 2.488.789 3.984.789 1.584 0 2.963-.295 4.136-.884 1.172-.596 2.082-1.417 2.728-2.463.653-1.052.976-2.256.97-3.613.006-1.235-.257-2.326-.79-3.27a5.806 5.806 0 0 0-2.157-2.234c-.907-.54-1.94-.808-3.1-.808-.989 0-1.857.196-2.605.589-.748.387-1.274.875-1.578 1.464h-.114l.38-4.297h8.747v-4.221H41.644l-.76 10.724 4.639.913a2.443 2.443 0 0 1 1.036-1.113 3.062 3.062 0 0 1 1.55-.409c.538 0 1.014.118 1.426.352.412.228.735.555.97.98.234.418.348.912.342 1.483.006.564-.108 1.058-.342 1.483a2.509 2.509 0 0 1-.97.989c-.412.228-.887.342-1.426.342-.698 0-1.3-.2-1.807-.6-.5-.398-.76-.934-.78-1.606H40.39c.012 1.21.348 2.282 1.008 3.214.665.931 1.575 1.663 2.728 2.196Zm-19.514.523v-3.803l7.263-6.009c.482-.399.894-.773 1.236-1.122.349-.355.615-.719.799-1.093.19-.374.285-.789.285-1.245 0-.501-.108-.929-.323-1.284-.21-.355-.5-.627-.875-.818-.374-.196-.805-.294-1.293-.294-.488 0-.919.098-1.293.294a2.05 2.05 0 0 0-.855.866c-.203.38-.305.843-.305 1.388h-5.02c0-1.37.308-2.548.923-3.537.614-.989 1.483-1.75 2.605-2.282 1.122-.532 2.437-.798 3.945-.798 1.56 0 2.91.25 4.05.75 1.148.495 2.032 1.192 2.653 2.092.627.9.941 1.956.941 3.166 0 .748-.155 1.493-.466 2.235-.31.735-.868 1.55-1.673 2.443-.805.894-1.949 1.958-3.432 3.194l-1.826 1.522v.114h7.606v4.221H24.611ZM65.1 31.107v2.97h4.084v10.609h3.633V34.078h4.084v-2.97H65.101Zm-4.744 4.243c-.035-.442-.201-.786-.497-1.034-.292-.247-.736-.371-1.333-.371-.38 0-.692.046-.935.14-.238.088-.415.21-.53.364a.901.901 0 0 0-.18.53.87.87 0 0 0 .087.444c.07.129.181.246.332.352.15.102.342.194.576.278.235.084.513.16.836.226l1.114.238c.751.16 1.394.37 1.929.63.535.261.972.568 1.313.922.34.349.59.742.749 1.18.163.438.247.915.252 1.432-.005.893-.228 1.649-.67 2.267-.442.62-1.074 1.09-1.896 1.413-.818.322-1.801.484-2.95.484-1.18 0-2.21-.175-3.09-.524-.875-.35-1.556-.886-2.042-1.611-.482-.73-.725-1.662-.73-2.798h3.501c.023.415.126.765.312 1.047.186.283.446.498.782.644.34.145.745.218 1.214.218.393 0 .722-.048.988-.145.265-.098.466-.233.603-.405a.955.955 0 0 0 .212-.59.838.838 0 0 0-.206-.544c-.128-.159-.34-.3-.636-.424-.296-.128-.696-.248-1.2-.358l-1.353-.292c-1.202-.26-2.15-.696-2.844-1.306-.69-.614-1.032-1.452-1.027-2.513-.005-.861.225-1.615.689-2.26.469-.65 1.116-1.156 1.943-1.519.83-.362 1.783-.543 2.857-.543 1.096 0 2.044.183 2.844.55.8.367 1.417.884 1.85 1.551.438.663.659 1.44.663 2.327h-3.527Zm-19.79-4.242v13.578h3.686v-4.482h1.276l2.383 4.482h4.005l-2.758-5.063a3.953 3.953 0 0 0 1.657-1.441c.434-.668.65-1.488.65-2.46 0-.964-.21-1.79-.63-2.48a4.12 4.12 0 0 0-1.763-1.584c-.756-.367-1.638-.55-2.646-.55h-5.86Zm3.686 6.232V34.05h1.3c.432 0 .802.06 1.107.18.309.114.545.295.709.543.168.243.252.559.252.948 0 .384-.084.696-.252.935a1.4 1.4 0 0 1-.71.524c-.304.106-.674.159-1.107.159h-1.3Zm-5.433-6.233v13.579h-3.687V31.108h3.687Zm-14.59 0v13.579h3.686v-5.304h5.278v-2.97h-5.278v-2.334h5.861v-2.97H24.23Z"
      />
    </Svg>
  )
}